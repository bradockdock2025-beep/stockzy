import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, order_status, payment_method, payment_status } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { RedisService } from '../../common/redis/redis.service';
import { StripeService } from '../stripe/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryPaymentDto } from './dto/query-payment.dto';

type StripeShipping = {
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
    state?: string | null;
  } | null;
  name?: string | null;
  phone?: string | null;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
    private readonly stripeService: StripeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createForOrder(input: {
    orderId: string;
    amount: Prisma.Decimal | number;
    currency?: string;
    method?: payment_method;
    requireConfirmation?: boolean;
    tx?: Prisma.TransactionClient;
    context?: AuditContext;
  }) {
    const client = input.tx ?? this.prisma;
    const existing = await client.payment.findUnique({ where: { orderId: input.orderId } });
    if (existing) {
      return { payment: existing, confirmationCode: undefined, created: false };
    }

    const method = input.method ?? payment_method.cod;
    const requireConfirmation = input.requireConfirmation ?? true;
    const now = new Date();

    let confirmationCode: string | undefined;
    let confirmationHash: string | null = null;
    let confirmationExpiresAt: Date | null = null;
    let status: payment_status;
    let confirmedAt: Date | null = null;

    if (requireConfirmation) {
      confirmationCode = this.generateConfirmationCode();
      confirmationHash = this.hashConfirmationCode(confirmationCode);
      confirmationExpiresAt = new Date(Date.now() + this.getConfirmationTtlMs());
      status = payment_status.awaiting_confirmation;
    } else {
      status = payment_status.paid;
      confirmedAt = now;
    }

    const payment = await client.payment.create({
      data: {
        orderId: input.orderId,
        method,
        status,
        amount: input.amount,
        currency: input.currency ?? this.getDefaultCurrency(),
        confirmationCodeHash: confirmationHash,
        confirmationCodeExpiresAt: confirmationExpiresAt,
        confirmationAttempts: 0,
        confirmedAt,
        confirmedBy: null,
      },
    });

    return { payment, confirmationCode, created: true };
  }

  async createForCustomerOrder(input: {
    orderId: string;
    authUserId: string;
    context?: AuditContext;
    idempotencyKey?: string;
    paymentMethod?: 'cod' | 'stripe';
  }) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId: input.authUserId },
      select: { id: true },
    });
    if (!customer) {
      throw new UnauthorizedException('Invalid customer');
    }

    const normalizedKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const redis = this.redisService.getClient();
    const idempotencyCacheKey =
      normalizedKey && redis
        ? `idempotency:payments:create:${customer.id}:${input.orderId}:${normalizedKey}`
        : null;

    if (idempotencyCacheKey && redis) {
      const existing = await redis.get(idempotencyCacheKey);
      if (existing && existing !== 'pending') {
        return this.findForCustomer(input.orderId, customer.id);
      }
      if (existing === 'pending') {
        throw new ConflictException('Payment creation is already being processed');
      }

      const acquired = await redis.set(idempotencyCacheKey, 'pending', {
        NX: true,
        EX: 600,
      });
      if (!acquired) {
        const current = await redis.get(idempotencyCacheKey);
        if (current && current !== 'pending') {
          return this.findForCustomer(input.orderId, customer.id);
        }
        throw new ConflictException('Payment creation is already being processed');
      }
    }

    try {
      const isStripe = input.paymentMethod === 'stripe';

      if (isStripe) {
        const result = await this.createStripePaymentForOrder({
          orderId: input.orderId,
          customerId: customer.id,
          context: input.context,
        });

        if (result.created) {
          await this.auditLog.log({
            action: 'payment.created',
            entity: 'payment',
            entityId: result.payment.id,
            after: { status: result.payment.status, orderId: result.order.id, method: 'stripe' },
            context: input.context,
            actor: { id: customer.id },
          });
        }

        if (idempotencyCacheKey && redis) {
          await redis.set(idempotencyCacheKey, result.payment.id, { EX: 86_400 });
        }

        return {
          order: result.order,
          payment: this.toCustomerPaymentResponse({
            payment: result.payment,
            clientSecret: result.payment.clientSecret,
          }),
          created: result.created,
        };
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, input.context);

        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: { items: true },
        });

        if (!order || order.customerId !== customer.id) {
          throw new NotFoundException('Order not found');
        }

        if (order.status === order_status.cancelled || order.status === order_status.refunded) {
          this.badRequest('ORDER_NOT_PAYABLE', 'Order cannot be paid');
        }

        if (order.status === order_status.paid) {
          this.badRequest('ORDER_ALREADY_PAID', 'Order already paid');
        }

        const paymentResult = await this.createForOrder({
          orderId: order.id,
          amount: order.totalAmount,
          method: payment_method.cod,
          requireConfirmation: true,
          tx,
          context: input.context,
        });

        return { order, ...paymentResult };
      });

      if (result.created) {
        await this.auditLog.log({
          action: 'payment.created',
          entity: 'payment',
          entityId: result.payment.id,
          after: { status: result.payment.status, orderId: result.order.id },
          context: input.context,
          actor: { id: customer.id },
        });
      }

      if (idempotencyCacheKey && redis) {
        await redis.set(idempotencyCacheKey, result.payment.id, { EX: 86_400 });
      }

      return {
        order: result.order,
        payment: this.toCustomerPaymentResponse({
          payment: result.payment,
          confirmationCode: result.confirmationCode,
        }),
        created: result.created,
      };
    } catch (error) {
      if (idempotencyCacheKey && redis) {
        await redis.del(idempotencyCacheKey);
      }
      throw error;
    }
  }

  async createGuestStripePayment(orderId: string): Promise<{ clientSecret: string; publishableKey: string }> {
    const existing = await this.prisma.payment.findUnique({ where: { orderId } });
    if (existing) {
      const meta = existing.metadata as Record<string, string> | null;
      return {
        clientSecret: meta?.clientSecret ?? '',
        publishableKey: this.stripeService.publishableKey,
      };
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === order_status.cancelled || order.status === order_status.refunded) {
      this.badRequest('ORDER_NOT_PAYABLE', 'Order cannot be paid');
    }

    const currency = this.getDefaultCurrency();
    const stripeAmount = this.stripeService.toStripeAmount(order.totalAmount, currency);

    const intent = await this.stripeService.createPaymentIntent({
      amount: stripeAmount,
      currency,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, isGuest: 'true' },
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: payment_method.stripe,
        status: payment_status.pending,
        amount: order.totalAmount,
        currency,
        metadata: { stripePaymentIntentId: intent.id, clientSecret: intent.client_secret },
      },
    });

    return {
      clientSecret: intent.client_secret!,
      publishableKey: this.stripeService.publishableKey,
    };
  }

  async handleStripePaymentSucceeded(intentId: string, stripeShipping?: StripeShipping | null, receiptEmail?: string | null) {
    const payment = await this.prisma.payment.findFirst({
      where: { metadata: { path: ['stripePaymentIntentId'], equals: intentId } },
      include: { order: { include: { items: true } } },
    });

    if (!payment) {
      this.logger.warn(`No payment found for Stripe PaymentIntent: ${intentId}`);
      return;
    }

    if (payment.status === payment_status.paid) {
      return;
    }

    const isPresaleOrder = payment.order.status === order_status.presale;
    const isGuestOrder = !payment.order.customerId;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: payment_status.paid, confirmedAt: new Date() },
      });

      if (!isPresaleOrder) {
        const orderUpdateData: Prisma.OrderUpdateInput = { status: order_status.paid };

        if (isGuestOrder && stripeShipping?.address) {
          orderUpdateData.shippingAddress = {
            name: stripeShipping.name ?? '',
            email: receiptEmail ?? '',
            street: stripeShipping.address.line1 ?? '',
            street2: stripeShipping.address.line2 ?? '',
            city: stripeShipping.address.city ?? '',
            zipcode: stripeShipping.address.postal_code ?? '',
            country: stripeShipping.address.country ?? '',
            state: stripeShipping.address.state ?? '',
          };
        }

        await tx.order.update({
          where: { id: payment.orderId },
          data: orderUpdateData,
        });

        for (const item of payment.order.items) {
          await tx.$executeRaw`
            UPDATE inventory
            SET stock_quantity = GREATEST(stock_quantity - ${item.quantity}, 0),
                reserved_quantity = GREATEST(reserved_quantity - ${item.quantity}, 0)
            WHERE variant_id = ${item.variantId};
          `;
        }
      }
    });

    await this.auditLog.log({
      action: 'payment.paid',
      entity: 'payment',
      entityId: payment.id,
      after: { status: payment_status.paid, orderId: payment.orderId, method: 'stripe' },
    });

    if (!isPresaleOrder) {
      void this.notificationsService.dispatch('order.created', payment.orderId);
      void this.notificationsService.dispatch('payment.confirmed', payment.orderId, {
        paymentMethod: 'Cartão de crédito',
      });
    }

    void this.notificationsService.dispatchInternal(payment.orderId);
  }

  async handleStripePaymentFailed(intentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { metadata: { path: ['stripePaymentIntentId'], equals: intentId } },
    });

    if (!payment || payment.status === payment_status.failed) {
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: payment_status.failed },
    });

    await this.auditLog.log({
      action: 'payment.failed',
      entity: 'payment',
      entityId: payment.id,
      after: { status: payment_status.failed, orderId: payment.orderId, method: 'stripe' },
    });

    void this.notificationsService.dispatch('payment.failed', payment.orderId);
  }

  private async createStripePaymentForOrder(input: {
    orderId: string;
    customerId: string;
    context?: AuditContext;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });

    if (!order || order.customerId !== input.customerId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === order_status.cancelled || order.status === order_status.refunded) {
      this.badRequest('ORDER_NOT_PAYABLE', 'Order cannot be paid');
    }

    if (order.status === order_status.paid) {
      this.badRequest('ORDER_ALREADY_PAID', 'Order already paid');
    }

    const existing = await this.prisma.payment.findUnique({ where: { orderId: input.orderId } });
    if (existing) {
      const meta = existing.metadata as Record<string, string> | null;
      const clientSecret = meta?.clientSecret ?? null;
      return { order, payment: { ...existing, clientSecret }, created: false };
    }

    const currency = this.getDefaultCurrency();
    const stripeAmount = this.stripeService.toStripeAmount(order.totalAmount, currency);

    const intent = await this.stripeService.createPaymentIntent({
      amount: stripeAmount,
      currency,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: payment_method.stripe,
        status: payment_status.pending,
        amount: order.totalAmount,
        currency,
        metadata: { stripePaymentIntentId: intent.id, clientSecret: intent.client_secret },
      },
    });

    return { order, payment: { ...payment, clientSecret: intent.client_secret }, created: true };
  }

  async confirmPayment(input: {
    orderId: string;
    code: string;
    authUserId: string;
    context?: AuditContext;
    idempotencyKey?: string;
  }) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId: input.authUserId },
      select: { id: true },
    });
    if (!customer) {
      throw new UnauthorizedException('Invalid customer');
    }

    const normalizedKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const redis = this.redisService.getClient();
    const idempotencyCacheKey =
      normalizedKey && redis
        ? `idempotency:payments:confirm:${customer.id}:${input.orderId}:${normalizedKey}`
        : null;

    if (idempotencyCacheKey && redis) {
      const existing = await redis.get(idempotencyCacheKey);
      if (existing && existing !== 'pending') {
        return this.findForCustomer(input.orderId, customer.id);
      }
      if (existing === 'pending') {
        throw new ConflictException('Payment confirmation is already being processed');
      }

      const acquired = await redis.set(idempotencyCacheKey, 'pending', { NX: true, EX: 600 });
      if (!acquired) {
        const current = await redis.get(idempotencyCacheKey);
        if (current && current !== 'pending') {
          return this.findForCustomer(input.orderId, customer.id);
        }
        throw new ConflictException('Payment confirmation is already being processed');
      }
    }

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { orderId: input.orderId },
        include: {
          order: { include: { items: true } },
        },
      });

      if (!payment || payment.order.customerId !== customer.id) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === payment_status.paid) {
        return {
          payment: this.toCustomerPaymentResponse({ payment }),
          order: payment.order,
          alreadyPaid: true,
        };
      }

      if (
        payment.status !== payment_status.awaiting_confirmation &&
        payment.status !== payment_status.pending
      ) {
        this.badRequest('PAYMENT_NOT_CONFIRMABLE', 'Payment cannot be confirmed');
      }

      if (!payment.confirmationCodeHash || !payment.confirmationCodeExpiresAt) {
        this.badRequest('PAYMENT_CODE_MISSING', 'Confirmation code is not available');
      }

      const now = new Date();
      if (payment.confirmationCodeExpiresAt <= now) {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: { not: payment_status.expired } },
          data: { status: payment_status.expired },
        });
        await this.auditLog.log({
          action: 'payment.expired',
          entity: 'payment',
          entityId: payment.id,
          after: { status: payment_status.expired, orderId: payment.orderId },
          context: input.context,
        });
        this.badRequest('PAYMENT_CODE_EXPIRED', 'Confirmation code expired');
      }

      const maxAttempts = this.getMaxAttempts();
      if (payment.confirmationAttempts >= maxAttempts) {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: { not: payment_status.failed } },
          data: { status: payment_status.failed },
        });
        await this.auditLog.log({
          action: 'payment.failed',
          entity: 'payment',
          entityId: payment.id,
          after: { status: payment_status.failed, orderId: payment.orderId },
          context: input.context,
        });
        this.badRequest('PAYMENT_CODE_ATTEMPTS_EXCEEDED', 'Too many attempts');
      }

      const normalizedCode = this.normalizeConfirmationCode(input.code);
      const hashedInput = this.hashConfirmationCode(normalizedCode);
      if (!this.timingSafeEqual(hashedInput, payment.confirmationCodeHash)) {
        const nextAttempts = payment.confirmationAttempts + 1;
        const nextStatus =
          nextAttempts >= maxAttempts ? payment_status.failed : payment.status;

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            confirmationAttempts: nextAttempts,
            ...(nextStatus !== payment.status ? { status: nextStatus } : {}),
          },
        });

        if (nextStatus === payment_status.failed) {
          await this.auditLog.log({
            action: 'payment.failed',
            entity: 'payment',
            entityId: payment.id,
            after: { status: payment_status.failed, orderId: payment.orderId },
            context: input.context,
          });
        }

        this.badRequest('PAYMENT_CODE_INVALID', 'Invalid confirmation code', {
          attemptsRemaining: Math.max(maxAttempts - nextAttempts, 0),
        });
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, input.context);

        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (order.status === order_status.cancelled || order.status === order_status.refunded) {
          this.badRequest('ORDER_NOT_CONFIRMABLE', 'Order cannot be paid');
        }

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: payment_status.paid,
            confirmedAt: now,
            confirmedBy: customer.id,
            confirmationCodeHash: null,
            confirmationCodeExpiresAt: null,
          },
        });

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: order_status.paid },
          include: { items: true },
        });

        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE inventory
            SET stock_quantity = GREATEST(stock_quantity - ${item.quantity}, 0),
                reserved_quantity = GREATEST(reserved_quantity - ${item.quantity}, 0)
            WHERE variant_id = ${item.variantId};
          `;
        }

        return { payment: updatedPayment, order: updatedOrder };
      });

      await this.auditLog.log({
        action: 'payment.confirmed',
        entity: 'payment',
        entityId: result.payment.id,
        after: { status: payment_status.paid, orderId: result.order.id },
        context: input.context,
        actor: { id: customer.id },
      });

      if (idempotencyCacheKey && redis) {
        await redis.set(idempotencyCacheKey, result.payment.id, { EX: 86_400 });
      }

      return {
        payment: this.toCustomerPaymentResponse({ payment: result.payment }),
        order: result.order,
      };
    } catch (error) {
      if (idempotencyCacheKey && redis) {
        await redis.del(idempotencyCacheKey);
      }
      throw error;
    }
  }

  async findAll(query: QueryPaymentDto) {
    const where: Prisma.PaymentWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.customerId) {
      where.order = { customerId: query.customerId };
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data;
      try {
        data = await this.prisma.payment.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: { order: true },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new BadRequestException('Invalid cursor');
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
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { order: true },
      }),
      this.prisma.payment.count({ where }),
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

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findForCustomer(orderId: string, customerId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { customerId } },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return { payment: this.toCustomerPaymentResponse({ payment }), order: payment.order };
  }

  shouldReturnConfirmationCode() {
    const env = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (env.toLowerCase() === 'production') {
      return false;
    }
    const explicit = this.configService.get<string>('PAYMENT_CONFIRMATION_RETURN_CODE');
    if (explicit) {
      return explicit.toLowerCase() === 'true';
    }
    return true;
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

  private getDefaultCurrency() {
    return this.configService.get<string>('PAYMENT_CURRENCY') ??
      this.configService.get<string>('DEFAULT_CURRENCY') ??
      'AOA';
  }

  private getConfirmationTtlMs() {
    const raw = this.configService.get<string>('PAYMENT_CONFIRMATION_TTL_HOURS');
    const parsed = raw ? Number(raw) : NaN;
    const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
    return hours * 60 * 60 * 1000;
  }

  private getMaxAttempts() {
    const raw = this.configService.get<string>('PAYMENT_CONFIRMATION_MAX_ATTEMPTS');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
  }

  private generateConfirmationCode() {
    const value = randomInt(0, 1_000_000);
    return String(value).padStart(6, '0');
  }

  private normalizeConfirmationCode(code: string) {
    return code.trim();
  }

  private hashConfirmationCode(code: string) {
    const secret = this.getConfirmationSecret();
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  private getConfirmationSecret() {
    const secret = this.configService.get<string>('PAYMENT_CONFIRMATION_SECRET');
    if (!secret) {
      this.logger.error('PAYMENT_CONFIRMATION_SECRET is not configured.');
      throw new InternalServerErrorException('Payment configuration error');
    }
    return secret;
  }

  private timingSafeEqual(a: string, b: string) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    const len = Math.max(aBuf.length, bBuf.length);
    const aPadded = Buffer.alloc(len);
    const bPadded = Buffer.alloc(len);
    aBuf.copy(aPadded);
    bBuf.copy(bPadded);
    // Always compare full length — no early return on size difference
    return timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
  }

  private toCustomerPaymentResponse(input: {
    payment: {
      id: string;
      orderId: string;
      method: payment_method;
      status: payment_status;
      amount: Prisma.Decimal | number;
      currency: string;
      confirmationCodeExpiresAt?: Date | null;
      confirmedAt?: Date | null;
    };
    confirmationCode?: string;
    clientSecret?: string | null;
  }) {
    const response: Record<string, unknown> = {
      id: input.payment.id,
      orderId: input.payment.orderId,
      method: input.payment.method,
      status: input.payment.status,
      amount: input.payment.amount,
      currency: input.payment.currency,
      confirmationCodeExpiresAt: input.payment.confirmationCodeExpiresAt ?? null,
      confirmedAt: input.payment.confirmedAt ?? null,
    };

    if (input.confirmationCode && this.shouldReturnConfirmationCode()) {
      response.confirmationCode = input.confirmationCode;
    }

    if (input.clientSecret) {
      response.clientSecret = input.clientSecret;
      response.publishableKey = this.stripeService.publishableKey;
    }

    return response;
  }

  private badRequest(code: string, message: string, details?: Record<string, unknown>): never {
    throw new BadRequestException({
      code,
      message,
      ...(details ?? {}),
    });
  }
}
