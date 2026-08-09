import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma, order_status, offer_status, payment_method, payment_status, product_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { OrdersQueueService } from './orders.queue.service';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { CreateGuestOrderFromOfferDto } from './dto/create-guest-order-from-offer.dto';
import { CreateCustomerOrderFromOfferDto } from './dto/create-customer-order-from-offer.dto';
import { CartService } from '../cart/cart.service';
import { RedisService } from '../../common/redis/redis.service';
import { ShippingService } from './shipping.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersQueue: OrdersQueueService,
    private readonly cartService: CartService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly shippingService: ShippingService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toJsonNullable(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.DbNull;
    }
    return this.toJsonValue(value);
  }

  private badRequest(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): never {
    throw new BadRequestException({
      code,
      message,
      ...(details ?? {}),
    });
  }

  private async ensureCustomerEmailVerified(authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { emailVerifiedAt: true },
    });

    if (!customer) {
      this.badRequest('CUSTOMER_NOT_FOUND', 'Customer profile not found');
    }

    if (!customer.emailVerifiedAt) {
      this.badRequest(
        'EMAIL_VERIFICATION_REQUIRED',
        'Seu email ainda nao foi confirmado. Verifique sua caixa de entrada e clique no link de confirmacao para finalizar a compra.',
        {
          action: 'RESEND_EMAIL_VERIFICATION',
          endpoint: '/customers/verify/email',
        },
      );
    }
  }

  async create(dto: CreateOrderDto, context?: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const order = await tx.order.create({
        data: {
          customerId: dto.customerId,
          orderNumber: dto.orderNumber,
          status: dto.status,
          subtotal: dto.subtotal,
          shippingAmount: dto.shippingAmount ?? 0,
          discountAmount: dto.discountAmount ?? 0,
          totalAmount: dto.totalAmount,
          shippingAddress: this.toJsonValue(dto.shippingAddress),
          billingAddress: this.toJsonNullable(dto.billingAddress ?? null),
        },
      });

      await tx.orderItem.createMany({
        data: dto.items.map((item) => ({
          orderId: order.id,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      });

      const paymentResult = await this.paymentsService.createForOrder({
        orderId: order.id,
        amount: order.totalAmount,
        method: payment_method.cod,
        requireConfirmation: order.status !== order_status.paid,
        tx,
        context,
      });

      const fullOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, customer: true },
      });

      return { order: fullOrder, payment: paymentResult.payment, confirmationCode: paymentResult.confirmationCode };
    });

    if (result?.order) {
      await this.ordersQueue.enqueueOrderCreated(result.order.id);
      const delayMs = this.resolvePaymentDelayMs(result.payment?.confirmationCodeExpiresAt);
      await this.enqueueReservationTimeoutIfNeeded(result.order.id, result.order.status, {
        overrideDelayMs: delayMs,
      });
    }

    return this.attachPaymentInfo(result);
  }

  async createFromCustomerCart(input: {
    authUserId: string;
    cartToken?: string;
    idempotencyKey?: string;
    dto: CreateCustomerOrderDto;
    context?: AuditContext;
  }) {
    const authUserId = input.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureCustomerEmailVerified(authUserId);

    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const redis = this.redisService.getClient();
    const idempotencyCacheKey =
      idempotencyKey && redis
        ? `idempotency:orders:${authUserId}:${idempotencyKey}`
        : null;

    if (idempotencyCacheKey && redis) {
      const existing = await redis.get(idempotencyCacheKey);
      if (existing && existing !== 'pending') {
        return this.findOneForCustomer(existing, authUserId);
      }
      if (existing === 'pending') {
        throw new ConflictException('Order request is already being processed');
      }

      const acquired = await redis.set(idempotencyCacheKey, 'pending', {
        NX: true,
        EX: 600,
      });
      if (!acquired) {
        const current = await redis.get(idempotencyCacheKey);
        if (current && current !== 'pending') {
          return this.findOneForCustomer(current, authUserId);
        }
        throw new ConflictException('Order request is already being processed');
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, input.context);

        const quote = await this.buildCartQuote({
          authUserId,
          cartToken: input.cartToken,
          dto: input.dto,
          requireShippingAddress: true,
          promoCode: input.dto.promoCode,
          tx,
        });

        const {
          customer,
          orderItems,
          subtotal,
          shippingAmount,
          discountAmount,
          totalAmount,
          shippingAddress,
          billingAddress,
          isPresaleOrder,
        } = quote;
        const resolvedShippingAddress = this.requireShippingAddress(shippingAddress);
        const orderNumber = await this.generateOrderNumber(tx);

        if (!isPresaleOrder) {
          for (const item of orderItems) {
            const [inv] = await tx.$queryRaw<
              Array<{ stock_quantity: number; reserved_quantity: number }>
            >`
              SELECT stock_quantity, reserved_quantity
              FROM inventory
              WHERE variant_id = ${item.variantId}
              FOR UPDATE;
            `;

            const available = inv
              ? Number(inv.stock_quantity) - Number(inv.reserved_quantity)
              : 0;

            if (available < item.quantity) {
              this.badRequest('INSUFFICIENT_STOCK', 'Insufficient stock', {
                variantId: item.variantId,
                available,
                requested: item.quantity,
                stockQuantity: inv ? Number(inv.stock_quantity) : 0,
                reservedQuantity: inv ? Number(inv.reserved_quantity) : 0,
              });
            }

            await tx.$executeRaw`
              UPDATE inventory
              SET reserved_quantity = reserved_quantity + ${item.quantity}
              WHERE variant_id = ${item.variantId};
            `;
          }
        }

        if (isPresaleOrder) {
          for (const item of orderItems) {
            const presaleVariant = await tx.productVariant.findUnique({
              where: { id: item.variantId },
              select: { presaleLimit: true },
            });
            if (presaleVariant?.presaleLimit !== null && presaleVariant?.presaleLimit !== undefined) {
              const sold = await tx.orderItem.aggregate({
                where: { variantId: item.variantId, order: { status: order_status.presale } },
                _sum: { quantity: true },
              });
              const totalSold = (sold._sum.quantity ?? 0) + item.quantity;
              if (totalSold > presaleVariant.presaleLimit) {
                this.badRequest('PRESALE_LIMIT_REACHED', 'Presale units sold out', {
                  variantId: item.variantId,
                  limit: presaleVariant.presaleLimit,
                  available: Math.max(0, presaleVariant.presaleLimit - (sold._sum.quantity ?? 0)),
                });
              }
            }
          }
        }

        const created = await tx.order.create({
          data: {
            customerId: customer.id,
            orderNumber,
            status: isPresaleOrder ? order_status.presale : order_status.pending,
            subtotal,
            shippingAmount,
            discountAmount,
            totalAmount,
            shippingAddress: this.toJsonValue(resolvedShippingAddress),
            billingAddress: this.toJsonNullable(billingAddress ?? null),
            locale: input.dto.locale ?? 'pt',
          },
        });

        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId: created.id,
            variantId: item.variantId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        });

        if (quote.promotion) {
          await tx.promotionUsage.create({
            data: {
              promotionId: quote.promotion.id,
              customerId: customer.id,
              orderId: created.id,
            },
          });
        }

        const isStripe = input.dto.paymentMethod === 'stripe';
        let paymentResult: Awaited<ReturnType<typeof this.paymentsService.createForOrder>> | null = null;

        if (!isStripe) {
          paymentResult = await this.paymentsService.createForOrder({
            orderId: created.id,
            amount: totalAmount,
            method: payment_method.cod,
            requireConfirmation: true,
            tx,
            context: input.context,
          });
        }

        const fullOrder = await tx.order.findUnique({
          where: { id: created.id },
          include: { items: true, customer: true },
        });
        return { order: fullOrder, payment: paymentResult?.payment ?? null, confirmationCode: paymentResult?.confirmationCode };
      });

      if (result?.order) {
        if (result.order.status === order_status.presale) {
          void this.notificationsService.dispatch('presale.confirmed', result.order.id);
        } else {
          await this.ordersQueue.enqueueOrderCreated(result.order.id);
          const delayMs = this.resolvePaymentDelayMs(result.payment?.confirmationCodeExpiresAt);
          await this.enqueueReservationTimeoutIfNeeded(result.order.id, result.order.status, {
            overrideDelayMs: delayMs,
          });
        }
      }

      await this.cartService.clear(input.cartToken);

      if (idempotencyCacheKey && redis && result?.order) {
        await redis.set(idempotencyCacheKey, result.order.id, { EX: 86_400 });
      }

      return this.attachPaymentInfo(result);
    } catch (error) {
      if (idempotencyCacheKey && redis) {
        await redis.del(idempotencyCacheKey);
      }
      throw error;
    }
  }

  async quoteFromCustomerCart(input: {
    authUserId: string;
    cartToken?: string;
    dto: CreateCustomerOrderDto;
  }) {
    const quote = await this.buildCartQuote({
      authUserId: input.authUserId,
      cartToken: input.cartToken,
      dto: input.dto,
      requireShippingAddress: false,
      promoCode: input.dto.promoCode,
    });

    return {
      items: quote.orderItems,
      subtotal: quote.subtotal,
      shippingAmount: quote.shippingAmount,
      discountAmount: quote.discountAmount,
      totalAmount: quote.totalAmount,
      shippingAddress: quote.shippingAddress,
      billingAddress: quote.billingAddress,
      promotion: quote.promotion,
    };
  }

  async findAll(query: QueryOrderDto) {
    const where: Prisma.OrderWhereInput = {};
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.status) {
      where.status = query.status;
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data: Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>[];
      try {
        data = await this.prisma.order.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: { items: true, customer: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          this.badRequest('INVALID_CURSOR', 'Invalid cursor');
        }
        throw error;
      }

      return {
        data,
        meta: {
          limit,
          nextCursor: data.length === limit ? data[data.length - 1]?.id : null,
        },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { items: true, customer: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllForCustomer(authUserId: string, query: QueryOrderDto) {
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const where: Prisma.OrderWhereInput = {
      customer: { authUserId },
    };
    if (query.status) {
      where.status = query.status;
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      type OrderRow = Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>;
      let rows: OrderRow[] = [];
      try {
        rows = await this.prisma.order.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: { items: true, customer: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          this.badRequest('INVALID_CURSOR', 'Invalid cursor');
        }
        throw error;
      }

      return {
        data: rows.map((o: OrderRow) => this.serializeOrderSummary(o)),
        meta: {
          limit,
          nextCursor: rows.length === limit ? rows[rows.length - 1]?.id : null,
        },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { items: true, customer: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: rows.map((o) => this.serializeOrderSummary(o)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForCustomer(id: string, authUserId: string) {
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const order = await this.prisma.order.findFirst({
      where: { id, customer: { authUserId } },
      include: { items: true, customer: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.serializeOrderDetail(order);
  }

  private serializeOrderSummary<T extends { totalAmount: Prisma.Decimal | null; status: order_status }>(order: T) {
    const { totalAmount, ...rest } = order as T & { totalAmount: Prisma.Decimal | null };
    return {
      ...rest,
      total: totalAmount ? Number(totalAmount) : 0,
    };
  }

  private serializeOrderDetail<T extends { totalAmount: Prisma.Decimal | null; status: order_status }>(order: T) {
    const { totalAmount, ...rest } = order as T & { totalAmount: Prisma.Decimal | null };
    return {
      ...rest,
      total: totalAmount ? Number(totalAmount) : 0,
      canBeCancelled: this.isCancellable(order.status),
    };
  }

  async cancelForCustomer(
    id: string,
    authUserId: string,
    context?: AuditContext,
    idempotencyKey?: string,
  ) {
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedKey = this.normalizeIdempotencyKey(idempotencyKey);
    const redis = this.redisService.getClient();
    const idempotencyCacheKey =
      normalizedKey && redis
        ? `idempotency:orders:cancel:${authUserId}:${id}:${normalizedKey}`
        : null;

    if (idempotencyCacheKey && redis) {
      const existing = await redis.get(idempotencyCacheKey);
      if (existing && existing !== 'pending') {
        return this.findOneForCustomer(existing, authUserId);
      }
      if (existing === 'pending') {
        throw new ConflictException('Cancel request is already being processed');
      }

      const acquired = await redis.set(idempotencyCacheKey, 'pending', {
        NX: true,
        EX: 600,
      });
      if (!acquired) {
        const current = await redis.get(idempotencyCacheKey);
        if (current && current !== 'pending') {
          return this.findOneForCustomer(current, authUserId);
        }
        throw new ConflictException('Cancel request is already being processed');
      }
    }

    try {
      let wasPresale = false;
      const result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        const order = await tx.order.findFirst({
          where: { id, customer: { authUserId } },
          include: { items: true, customer: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        wasPresale = order.status === order_status.presale;
        return this.cancelOrder(tx, order);
      });

      if (idempotencyCacheKey && redis) {
        await redis.set(idempotencyCacheKey, id, { EX: 86_400 });
      }

      if (result?.id) {
        if (wasPresale) {
          void this.notificationsService.dispatch('presale.cancelled', result.id);
        } else {
          void this.notificationsService.dispatch('order.cancelled', result.id);
          void this.notificationsService.dispatchInternalCancelled(result.id);
        }
      }

      return result;
    } catch (error) {
      if (idempotencyCacheKey && redis) {
        await redis.del(idempotencyCacheKey);
      }
      throw error;
    }
  }

  async getSalesSummary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      byStatus,
      revenueAll,
      revenueToday,
      revenueMonth,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startOfToday } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          items: { select: { productName: true, quantity: true, totalPrice: true } },
        },
      }),
    ]);

    return {
      totalOrders,
      totalRevenue: Number(revenueAll._sum.totalAmount ?? 0),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      today: {
        orders: revenueToday._count.id,
        revenue: Number(revenueToday._sum.totalAmount ?? 0),
      },
      thisMonth: {
        orders: revenueMonth._count.id,
        revenue: Number(revenueMonth._sum.totalAmount ?? 0),
      },
      recentOrders,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, dto: UpdateOrderDto, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Order not found');
      }

      const order = await tx.order.update({
        where: { id },
        data: {
          orderNumber: dto.orderNumber ?? undefined,
          status: dto.status ?? undefined,
          subtotal: dto.subtotal ?? undefined,
          shippingAmount: dto.shippingAmount ?? undefined,
          discountAmount: dto.discountAmount ?? undefined,
          totalAmount: dto.totalAmount ?? undefined,
          shippingAddress:
            dto.shippingAddress === undefined
              ? undefined
              : this.toJsonValue(dto.shippingAddress),
          billingAddress: this.toJsonNullable(dto.billingAddress),
        },
      });

      if (dto.items) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: dto.items.map((item) => ({
            orderId: id,
            variantId: item.variantId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, customer: true },
      });
    });
  }

  async remove(id: string, context?: AuditContext, idempotencyKey?: string) {
    const normalizedKey = this.normalizeIdempotencyKey(idempotencyKey);
    const redis = this.redisService.getClient();
    const idempotencyCacheKey =
      normalizedKey && redis
        ? `idempotency:orders:cancel:admin:${id}:${normalizedKey}`
        : null;

    if (idempotencyCacheKey && redis) {
      const existing = await redis.get(idempotencyCacheKey);
      if (existing && existing !== 'pending') {
        return this.findOne(existing);
      }
      if (existing === 'pending') {
        throw new ConflictException('Cancel request is already being processed');
      }

      const acquired = await redis.set(idempotencyCacheKey, 'pending', {
        NX: true,
        EX: 600,
      });
      if (!acquired) {
        const current = await redis.get(idempotencyCacheKey);
        if (current && current !== 'pending') {
          return this.findOne(current);
        }
        throw new ConflictException('Cancel request is already being processed');
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        const existing = await tx.order.findUnique({
          where: { id },
          include: { items: true, customer: true },
        });
        if (!existing) {
          throw new NotFoundException('Order not found');
        }

        return this.cancelOrder(tx, existing);
      });

      if (idempotencyCacheKey && redis) {
        await redis.set(idempotencyCacheKey, id, { EX: 86_400 });
      }

      if (result?.id) {
        void this.notificationsService.dispatch('order.cancelled', result.id);
        void this.notificationsService.dispatchInternalCancelled(result.id);
      }

      return result;
    } catch (error) {
      if (idempotencyCacheKey && redis) {
        await redis.del(idempotencyCacheKey);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: order_status, context?: AuditContext) {
    const VALID_TRANSITIONS: Partial<Record<order_status, order_status[]>> = {
      [order_status.pending]:    [order_status.processing, order_status.cancelled],
      [order_status.paid]:       [order_status.processing, order_status.shipped, order_status.cancelled],
      [order_status.presale]:    [order_status.processing, order_status.cancelled],
      [order_status.processing]: [order_status.shipped, order_status.cancelled],
      [order_status.shipped]:    [order_status.delivered, order_status.cancelled],
      [order_status.delivered]:  [order_status.refunded],
    };

    const order = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const existing = await tx.order.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Order not found');

      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(status)) {
        this.badRequest(
          'INVALID_STATUS_TRANSITION',
          `Cannot transition from ${existing.status} to ${status}`,
        );
      }

      return tx.order.update({
        where: { id },
        data: { status },
        include: { items: true, customer: true },
      });
    });

    if (status === order_status.shipped) {
      void this.notificationsService.dispatch('order.shipped', id);
    } else if (status === order_status.delivered) {
      void this.notificationsService.dispatch('order.delivered', id);
    } else if (status === order_status.cancelled) {
      void this.notificationsService.dispatch('order.cancelled', id);
      void this.notificationsService.dispatchInternalCancelled(id);
    }

    return order;
  }

  async findTrackingForCustomer(id: string, authUserId: string) {
    if (!authUserId) throw new UnauthorizedException('Invalid credentials');

    const order = await this.prisma.order.findFirst({
      where: { id, customer: { authUserId } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            estimatedDeliveryAt: true,
            shippedAt: true,
            deliveredAt: true,
            status: true,
            events: {
              orderBy: { occurredAt: 'desc' },
              select: {
                status: true,
                message: true,
                location: true,
                occurredAt: true,
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const { shipments, ...rest } = order;
    return {
      ...rest,
      shipment: shipments[0] ?? null,
    };
  }

  private normalizeIdempotencyKey(raw?: string) {
    if (!raw) {
      return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.slice(0, 128);
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('orders_display_seq')
    `;
    return `STKZ-${String(rows[0].nextval).padStart(8, '0')}`;
  }

  private resolvePaymentDelayMs(expiresAt?: Date | null) {
    if (!expiresAt) {
      return undefined;
    }
    const diff = expiresAt.getTime() - Date.now();
    if (!Number.isFinite(diff)) {
      return undefined;
    }
    return Math.max(diff, 0);
  }

  private attachPaymentInfo(
    result:
      | {
          order: Record<string, unknown> | null;
          payment?: {
            id: string;
            status: payment_status;
            method: payment_method;
            confirmationCodeExpiresAt?: Date | null;
          } | null;
          confirmationCode?: string;
        }
      | null
      | undefined,
  ) {
    if (!result || !result.order) {
      return result?.order ?? null;
    }

    const { order, payment, confirmationCode } = result;
    if (
      payment &&
      confirmationCode &&
      this.paymentsService.shouldReturnConfirmationCode()
    ) {
      return {
        ...order,
        payment: {
          id: payment.id,
          status: payment.status,
          method: payment.method,
          confirmationCode,
          confirmationCodeExpiresAt: payment.confirmationCodeExpiresAt ?? null,
        },
      };
    }

    return order;
  }

  private async resolveShippingAddress(
    customerId: string,
    dto: Pick<CreateCustomerOrderDto, 'addressId' | 'shippingAddress'>,
    required = true,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    if (dto.addressId) {
      const address = await client.address.findUnique({
        where: { id: dto.addressId },
      });
      if (!address || address.customerId !== customerId) {
        this.badRequest('ADDRESS_NOT_FOUND', 'Address not found');
      }

      return {
        addressId: address.id,
        type: address.type,
        street: address.street,
        city: address.city,
        state: address.state,
        zipcode: address.zipcode,
        country: address.country,
      };
    }

    if (dto.shippingAddress && Object.keys(dto.shippingAddress).length > 0) {
      return dto.shippingAddress;
    }

    if (!required) {
      return null;
    }

    this.badRequest('SHIPPING_ADDRESS_REQUIRED', 'Shipping address is required');
  }

  private requireShippingAddress(address: Record<string, unknown> | null) {
    if (!address) {
      this.badRequest('SHIPPING_ADDRESS_REQUIRED', 'Shipping address is required');
    }
    return address;
  }

  /**
   * Resolve o carrinho (só {variantId, quantity} no Redis, ver CartService) contra
   * variante/produto/estoque real — valida disponibilidade, mistura de presale, e
   * calcula subtotal. Usado tanto pelo quote/checkout de cliente logado quanto pelo
   * de convidado, pra não duplicar a validação nos dois fluxos.
   */
  private async resolveCartItems(
    cartToken: string | undefined,
    client: Prisma.TransactionClient | PrismaService,
  ) {
    const cart = await this.cartService.getCart(cartToken);
    const items = cart.cart.items;
    if (!items.length) {
      this.badRequest('CART_EMPTY', 'Cart is empty');
    }

    const variantIds = items.map((item) => item.variantId);
    const variants = await client.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        product: { status: product_status.active },
      },
      include: {
        product: true,
        inventory: true,
      },
    });

    if (variants.length !== variantIds.length) {
      this.badRequest('ITEMS_UNAVAILABLE', 'Some items are unavailable');
    }

    const presaleCount = variants.filter((v) => v.presaleEnabled).length;
    const normalCount = variants.filter((v) => !v.presaleEnabled).length;
    if (presaleCount > 0 && normalCount > 0) {
      this.badRequest(
        'MIXED_CART_NOT_ALLOWED',
        'Cannot mix presale items with regular items. Please checkout separately.',
      );
    }
    const isPresaleOrder = presaleCount > 0;

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    let subtotal = new Prisma.Decimal(0);

    const orderItems = items.map((item) => {
      const variant = variantsById.get(item.variantId);
      if (!variant) {
        this.badRequest('INVENTORY_UNAVAILABLE', 'Inventory unavailable', {
          variantId: item.variantId,
        });
      }

      if (!variant.presaleEnabled) {
        if (!variant.inventory) {
          this.badRequest('INVENTORY_UNAVAILABLE', 'Inventory unavailable', {
            variantId: item.variantId,
          });
        }
        const available =
          variant.inventory.stockQuantity - variant.inventory.reservedQuantity;
        if (available < item.quantity) {
          this.badRequest('INSUFFICIENT_STOCK', 'Insufficient stock', {
            variantId: variant.id,
            available,
            requested: item.quantity,
          });
        }
      }

      const unitPrice = variant.presaleEnabled && variant.presalePrice
        ? variant.presalePrice
        : variant.price;
      const totalPrice = unitPrice.mul(item.quantity);
      subtotal = subtotal.plus(totalPrice);

      return {
        variantId: variant.id,
        productId: variant.product.id,
        categoryId: variant.product.categoryId,
        productName: variant.product.name,
        sku: variant.sku ?? variant.id,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        weightKg: variant.weightKg ?? null,
        isPresale: variant.presaleEnabled,
      };
    });

    return { orderItems, subtotal, isPresaleOrder };
  }

  private async buildCartQuote(input: {
    authUserId: string;
    cartToken?: string;
    dto: CreateCustomerOrderDto;
    requireShippingAddress: boolean;
    promoCode?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const { authUserId, cartToken, dto, requireShippingAddress, promoCode, tx } = input;
    const client = tx ?? this.prisma;

    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!cartToken) {
      this.badRequest('CART_TOKEN_REQUIRED', 'x-cart-token is required');
    }

    const customer = await client.customer.findUnique({
      where: { authUserId },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Invalid customer');
    }

    const { orderItems, subtotal, isPresaleOrder } = await this.resolveCartItems(cartToken, client);

    const shippingAddress = await this.resolveShippingAddress(
      customer.id,
      dto,
      requireShippingAddress,
      tx,
    );
    const billingAddress = dto.billingAddress ?? null;

    const shippingAmount = this.shippingService.calculate({
      items: orderItems,
      address: shippingAddress,
    });
    const { promotion, discountAmount } = await this.resolvePromotion({
      customerId: customer.id,
      promoCode,
      subtotal,
      orderItems,
      tx: client,
    });

    let totalAmount = subtotal.plus(shippingAmount).minus(discountAmount);
    if (totalAmount.lessThan(0)) {
      totalAmount = new Prisma.Decimal(0);
    }

    return {
      customer,
      orderItems,
      subtotal,
      shippingAmount,
      discountAmount,
      totalAmount,
      shippingAddress,
      billingAddress,
      promotion,
      isPresaleOrder,
    };
  }

  private async resolvePromotion(input: {
    customerId: string;
    promoCode?: string;
    subtotal: Prisma.Decimal;
    orderItems: Array<{
      productId: string;
      categoryId: string | null;
      totalPrice: Prisma.Decimal;
    }>;
    tx: Prisma.TransactionClient | PrismaService;
  }) {
    const promoCode = input.promoCode?.trim();
    const now = new Date();

    const where: Prisma.PromotionWhereInput = {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };

    if (promoCode) {
      where.code = promoCode.toUpperCase();
    } else {
      where.code = null;
    }

    const promotions = await input.tx.promotion.findMany({
      where,
      include: { targets: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    if (promoCode && promotions.length === 0) {
      this.badRequest('PROMO_INVALID', 'Invalid or inactive promo code');
    }

    let best:
      | {
          promotion: Prisma.PromotionGetPayload<{ include: { targets: true } }>;
          discountAmount: Prisma.Decimal;
        }
      | null = null;

    for (const promotion of promotions) {
      if (promotion.minSubtotal) {
        const minSubtotal = new Prisma.Decimal(promotion.minSubtotal);
        if (input.subtotal.lessThan(minSubtotal)) {
          continue;
        }
      }

      if (promotion.maxUses !== null && promotion.maxUses !== undefined) {
        const totalUses = await input.tx.promotionUsage.count({
          where: { promotionId: promotion.id },
        });
        if (totalUses >= promotion.maxUses) {
          continue;
        }
      }

      if (
        promotion.maxUsesPerCustomer !== null &&
        promotion.maxUsesPerCustomer !== undefined
      ) {
        const customerUses = await input.tx.promotionUsage.count({
          where: { promotionId: promotion.id, customerId: input.customerId },
        });
        if (customerUses >= promotion.maxUsesPerCustomer) {
          continue;
        }
      }

      const targets = promotion.targets ?? [];
      let eligibleSubtotal = new Prisma.Decimal(0);
      const hasCartTarget =
        targets.length === 0 || targets.some((t) => t.targetType === 'cart');

      if (hasCartTarget) {
        eligibleSubtotal = input.subtotal;
      } else {
        const productIds = new Set(
          targets.filter((t) => t.targetType === 'product').map((t) => t.productId),
        );
        const categoryIds = new Set(
          targets.filter((t) => t.targetType === 'category').map((t) => t.categoryId),
        );

        eligibleSubtotal = input.orderItems.reduce((acc, item) => {
          if (productIds.has(item.productId)) {
            return acc.plus(item.totalPrice);
          }
          if (item.categoryId && categoryIds.has(item.categoryId)) {
            return acc.plus(item.totalPrice);
          }
          return acc;
        }, new Prisma.Decimal(0));
      }

      if (eligibleSubtotal.lessThanOrEqualTo(0)) {
        continue;
      }

      const value = new Prisma.Decimal(promotion.value);
      let discountAmount = new Prisma.Decimal(0);
      if (promotion.type === 'percent') {
        if (value.lessThanOrEqualTo(0)) {
          continue;
        }
        discountAmount = eligibleSubtotal.mul(value).div(100);
      } else {
        discountAmount = value;
        if (discountAmount.greaterThan(eligibleSubtotal)) {
          discountAmount = eligibleSubtotal;
        }
      }

      if (discountAmount.lessThanOrEqualTo(0)) {
        continue;
      }

      if (!best) {
        best = { promotion, discountAmount };
        continue;
      }

      if (promotion.priority > best.promotion.priority) {
        best = { promotion, discountAmount };
        continue;
      }

      if (
        promotion.priority === best.promotion.priority &&
        discountAmount.greaterThan(best.discountAmount)
      ) {
        best = { promotion, discountAmount };
      }
    }

    if (promoCode && !best) {
      this.badRequest('PROMO_NOT_ELIGIBLE', 'Promo code not eligible');
    }

    if (!best) {
      return { promotion: null, discountAmount: new Prisma.Decimal(0) };
    }

    return {
      promotion: {
        id: best.promotion.id,
        name: best.promotion.name,
        code: best.promotion.code,
        type: best.promotion.type,
        value: best.promotion.value,
      },
      discountAmount: best.discountAmount,
    };
  }

  private isCancellable(status: order_status) {
    const cancellable = new Set<order_status>([
      order_status.pending,
      order_status.paid,
      order_status.presale,
      order_status.processing,
    ]);
    return cancellable.has(status);
  }

  async activatePresaleBatch(variantId: string, context?: AuditContext) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: order_status.presale,
        items: { some: { variantId } },
      },
      include: { items: true },
    });

    if (!orders.length) {
      return { activated: 0 };
    }

    const totalQuantity = orders.reduce((sum, o) => {
      return sum + o.items.filter((i) => i.variantId === variantId).reduce((s, i) => s + i.quantity, 0);
    }, 0);

    const inv = await this.prisma.inventory.findUnique({ where: { variantId } });
    const available = inv ? inv.stockQuantity - inv.reservedQuantity : 0;
    if (available < totalQuantity) {
      throw new BadRequestException(
        `Insufficient stock to fulfill all presale orders. Available: ${available}, required: ${totalQuantity}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      for (const order of orders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: order_status.processing },
        });

        const qty = order.items.filter((i) => i.variantId === variantId).reduce((s, i) => s + i.quantity, 0);
        await tx.$executeRaw`
          UPDATE inventory
          SET stock_quantity = GREATEST(stock_quantity - ${qty}, 0)
          WHERE variant_id = ${variantId};
        `;
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: { presaleEnabled: false },
      });
    });

    for (const order of orders) {
      void this.notificationsService.dispatch('presale.fulfilled', order.id);
    }

    return { activated: orders.length };
  }

  /**
   * Preview do carrinho de convidado antes de criar o pedido de vez — mesmo papel que
   * `buildCartQuote` já dá pro cliente logado (nome/preço/subtotal/frete/total), só que
   * sem promoção (guest checkout hoje não aplica código promocional, ver createGuestOrder).
   */
  async quoteGuestCart(input: { cartToken: string; country: string }) {
    const { orderItems, subtotal, isPresaleOrder } = await this.resolveCartItems(
      input.cartToken,
      this.prisma,
    );

    const shippingAmount = this.shippingService.calculate({
      items: orderItems,
      address: { country: input.country },
    });
    const totalAmount = subtotal.plus(shippingAmount);

    return {
      items: orderItems,
      subtotal,
      shippingAmount,
      totalAmount,
      isPresaleOrder,
    };
  }

  async createGuestOrder(input: {
    cartToken: string;
    phone: string;
    country: string;
    locale?: string;
  }) {
    const { orderItems, subtotal, isPresaleOrder } = await this.resolveCartItems(
      input.cartToken,
      this.prisma,
    );

    const shippingAmount = this.shippingService.calculate({
      items: orderItems,
      address: { country: input.country },
    });
    const totalAmount = subtotal.plus(shippingAmount);
    const guestToken = randomUUID();

    const order = await this.prisma.$transaction(async (tx) => {
      if (!isPresaleOrder) {
        for (const item of orderItems) {
          const [inv] = await tx.$queryRaw<Array<{ stock_quantity: number; reserved_quantity: number }>>`
            SELECT stock_quantity, reserved_quantity FROM inventory WHERE variant_id = ${item.variantId} FOR UPDATE;
          `;
          const available = inv ? Number(inv.stock_quantity) - Number(inv.reserved_quantity) : 0;
          if (available < item.quantity) {
            this.badRequest('INSUFFICIENT_STOCK', 'Insufficient stock', {
              variantId: item.variantId, available, requested: item.quantity,
            });
          }
          await tx.$executeRaw`
            UPDATE inventory SET reserved_quantity = reserved_quantity + ${item.quantity} WHERE variant_id = ${item.variantId};
          `;
        }
      }

      if (isPresaleOrder) {
        for (const item of orderItems) {
          const presaleVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { presaleLimit: true },
          });
          if (presaleVariant?.presaleLimit !== null && presaleVariant?.presaleLimit !== undefined) {
            const sold = await tx.orderItem.aggregate({
              where: { variantId: item.variantId, order: { status: order_status.presale } },
              _sum: { quantity: true },
            });
            const totalSold = (sold._sum.quantity ?? 0) + item.quantity;
            if (totalSold > presaleVariant.presaleLimit) {
              this.badRequest('PRESALE_LIMIT_REACHED', 'Presale units sold out', {
                variantId: item.variantId,
                limit: presaleVariant.presaleLimit,
                available: Math.max(0, presaleVariant.presaleLimit - (sold._sum.quantity ?? 0)),
              });
            }
          }
        }
      }

      const orderNumber = await this.generateOrderNumber(tx);
      const created = await tx.order.create({
        data: {
          customerId: null,
          guestPhone: input.phone,
          guestToken,
          orderNumber,
          status: isPresaleOrder ? order_status.presale : order_status.pending,
          subtotal,
          shippingAmount,
          discountAmount: 0,
          totalAmount,
          shippingAddress: this.toJsonValue({ country: input.country }),
          locale: input.locale ?? 'fr',
        },
      });

      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          orderId: created.id,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      });

      return created;
    });

    await this.cartService.clear(input.cartToken);
    await this.enqueueReservationTimeoutIfNeeded(order.id, order.status);

    const stripePayment = await this.paymentsService.createGuestStripePayment(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      guestToken,
      clientSecret: stripePayment.clientSecret,
      publishableKey: stripePayment.publishableKey,
    };
  }

  async findGuestOrder(orderId: string, guestToken: string) {
    if (!guestToken) {
      throw new UnauthorizedException('Missing token');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, guestToken },
      include: {
        items: true,
        payment: { select: { status: true, method: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Finaliza o checkout de uma oferta já aceita pelo admin (guest) — ver
   * regra 3 do §4 do PLANO_MAKE_OFFER.md. A unidade já foi reservada no
   * aceite (OffersService.accept); aqui só "transfere" essa reserva pro
   * pedido de verdade, no preço negociado (offer.offeredPrice), não no
   * preço de tabela da variante.
   */
  async createGuestOrderFromOffer(input: {
    offerId: string;
    guestToken: string;
    phone: string;
    country: string;
    locale?: string;
  }) {
    if (!input.guestToken) {
      throw new UnauthorizedException('Missing token');
    }

    const offer = await this.prisma.offer.findFirst({
      where: { id: input.offerId, guestToken: input.guestToken },
      include: { variant: { include: { product: true } } },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== offer_status.accepted) {
      this.badRequest('OFFER_NOT_ACCEPTED', 'Offer is not accepted', { status: offer.status });
    }
    if (offer.expiresAt < new Date()) {
      this.badRequest('OFFER_EXPIRED', 'Offer checkout window has expired');
    }

    const shippingAmount = this.shippingService.calculate({
      items: [{ weightKg: offer.variant.weightKg ?? null, quantity: 1 }],
      address: { country: input.country },
    });
    const totalAmount = offer.offeredPrice.plus(shippingAmount);
    const guestToken = randomUUID();

    const order = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ status: offer_status }>>`
        SELECT status FROM offers WHERE id = ${offer.id} FOR UPDATE;
      `;
      if (!locked || locked.status !== offer_status.accepted) {
        this.badRequest('OFFER_NOT_ACCEPTED', 'Offer is not accepted');
      }

      const orderNumber = await this.generateOrderNumber(tx);
      const created = await tx.order.create({
        data: {
          customerId: null,
          guestPhone: input.phone,
          guestToken,
          orderNumber,
          status: order_status.pending,
          subtotal: offer.offeredPrice,
          shippingAmount,
          discountAmount: 0,
          totalAmount,
          shippingAddress: this.toJsonValue({ country: input.country }),
          locale: input.locale ?? 'fr',
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: created.id,
          variantId: offer.variant.id,
          productName: offer.variant.product.name,
          sku: offer.variant.sku ?? offer.variant.id,
          quantity: 1,
          unitPrice: offer.offeredPrice,
          totalPrice: offer.offeredPrice,
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { status: offer_status.converted, orderId: created.id },
      });

      return created;
    });

    await this.enqueueReservationTimeoutIfNeeded(order.id, order.status);
    const stripePayment = await this.paymentsService.createGuestStripePayment(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      guestToken,
      clientSecret: stripePayment.clientSecret,
      publishableKey: stripePayment.publishableKey,
    };
  }

  /** Mesma lógica que createGuestOrderFromOffer, versão cliente autenticado. */
  async createOrderFromOfferForCustomer(input: {
    authUserId: string;
    dto: CreateCustomerOrderFromOfferDto;
    context?: AuditContext;
  }) {
    const authUserId = input.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.ensureCustomerEmailVerified(authUserId);

    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!customer) {
      throw new UnauthorizedException('Invalid customer');
    }

    const offer = await this.prisma.offer.findFirst({
      where: { id: input.dto.offerId, customerId: customer.id },
      include: { variant: { include: { product: true } } },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== offer_status.accepted) {
      this.badRequest('OFFER_NOT_ACCEPTED', 'Offer is not accepted', { status: offer.status });
    }
    if (offer.expiresAt < new Date()) {
      this.badRequest('OFFER_EXPIRED', 'Offer checkout window has expired');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, input.context);

      const [locked] = await tx.$queryRaw<Array<{ status: offer_status }>>`
        SELECT status FROM offers WHERE id = ${offer.id} FOR UPDATE;
      `;
      if (!locked || locked.status !== offer_status.accepted) {
        this.badRequest('OFFER_NOT_ACCEPTED', 'Offer is not accepted');
      }

      const shippingAddress = await this.resolveShippingAddress(customer.id, input.dto, true, tx);
      const resolvedShippingAddress = this.requireShippingAddress(shippingAddress);

      const shippingAmount = this.shippingService.calculate({
        items: [{ weightKg: offer.variant.weightKg ?? null, quantity: 1 }],
        address: resolvedShippingAddress,
      });
      const totalAmount = offer.offeredPrice.plus(shippingAmount);
      const orderNumber = await this.generateOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          customerId: customer.id,
          orderNumber,
          status: order_status.pending,
          subtotal: offer.offeredPrice,
          shippingAmount,
          discountAmount: 0,
          totalAmount,
          shippingAddress: this.toJsonValue(resolvedShippingAddress),
          billingAddress: this.toJsonNullable(input.dto.billingAddress ?? null),
          locale: input.dto.locale ?? 'pt',
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: created.id,
          variantId: offer.variant.id,
          productName: offer.variant.product.name,
          sku: offer.variant.sku ?? offer.variant.id,
          quantity: 1,
          unitPrice: offer.offeredPrice,
          totalPrice: offer.offeredPrice,
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { status: offer_status.converted, orderId: created.id },
      });

      const isStripe = input.dto.paymentMethod === 'stripe';
      let paymentResult: Awaited<ReturnType<typeof this.paymentsService.createForOrder>> | null = null;

      if (!isStripe) {
        paymentResult = await this.paymentsService.createForOrder({
          orderId: created.id,
          amount: totalAmount,
          method: payment_method.cod,
          requireConfirmation: true,
          tx,
          context: input.context,
        });
      }

      const fullOrder = await tx.order.findUnique({
        where: { id: created.id },
        include: { items: true, customer: true },
      });
      return { order: fullOrder, payment: paymentResult?.payment ?? null, confirmationCode: paymentResult?.confirmationCode };
    });

    if (result?.order) {
      await this.ordersQueue.enqueueOrderCreated(result.order.id);
      const delayMs = this.resolvePaymentDelayMs(result.payment?.confirmationCodeExpiresAt);
      await this.enqueueReservationTimeoutIfNeeded(result.order.id, result.order.status, {
        overrideDelayMs: delayMs,
      });
    }

    return this.attachPaymentInfo(result);
  }

  async releaseReservationIfPending(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, {
        actorRole: 'system',
        actorEmail: 'system@local',
      });
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, customer: true },
      });

      if (!order) {
        return null;
      }

      if (order.status !== order_status.pending) {
        return order;
      }

      return this.cancelOrder(tx, order, payment_status.expired);
    });
  }

  private async cancelOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      status: order_status;
      items: Array<{ variantId: string; quantity: number }>;
    },
    paymentStatus: payment_status = payment_status.cancelled,
  ) {
    if (order.status === order_status.cancelled) {
      return order;
    }

    if (!this.isCancellable(order.status)) {
      this.badRequest('ORDER_NOT_CANCELLABLE', 'Order cannot be cancelled');
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: order_status.cancelled },
    });

    if (order.status !== order_status.presale) {
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE inventory
          SET reserved_quantity = GREATEST(reserved_quantity - ${item.quantity}, 0)
          WHERE variant_id = ${item.variantId};
        `;
      }
    }

    await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: { not: payment_status.paid },
      },
      data: {
        status: paymentStatus,
      },
    });

    return tx.order.findUnique({
      where: { id: order.id },
      include: { items: true, customer: true },
    });
  }

  private getReservationTimeoutMs() {
    const raw = this.configService.get<string>('ORDER_RESERVATION_TIMEOUT_MINUTES');
    const parsed = raw ? Number(raw) : NaN;
    const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
    return minutes * 60 * 1000;
  }

  private async enqueueReservationTimeoutIfNeeded(
    orderId: string,
    status: order_status,
    options?: { skip?: boolean; overrideDelayMs?: number },
  ) {
    if (status !== order_status.pending) {
      return;
    }
    if (options?.skip) {
      return;
    }

    await this.ordersQueue.enqueueReservationTimeout(
      orderId,
      options?.overrideDelayMs ?? this.getReservationTimeoutMs(),
    );
  }
}
