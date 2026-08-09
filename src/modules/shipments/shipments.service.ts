import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, order_status, shipment_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';
import { QueryShipmentDto } from './dto/query-shipment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  private parseDate(value?: string | null) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toJson(value?: Record<string, unknown>) {
    if (value === undefined) {
      return undefined;
    }
    return value as Prisma.InputJsonValue;
  }

  private assertOrderMutable(status: order_status) {
    if (status === order_status.cancelled || status === order_status.refunded) {
      this.badRequest('ORDER_LOCKED', 'Order cannot be updated for shipments');
    }
  }

  private async applyOrderStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: shipment_status,
  ) {
    if (status === shipment_status.shipped) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: order_status.shipped },
      });
      return;
    }
    if (status === shipment_status.delivered) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: order_status.delivered },
      });
    }
  }

  private normalizeDates(input: {
    status: shipment_status;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    existing?: { shippedAt: Date | null; deliveredAt: Date | null };
  }) {
    const now = new Date();
    const shippedAt =
      input.shippedAt !== undefined
        ? this.parseDate(input.shippedAt)
        : input.existing?.shippedAt ?? null;
    const deliveredAt =
      input.deliveredAt !== undefined
        ? this.parseDate(input.deliveredAt)
        : input.existing?.deliveredAt ?? null;

    let normalizedShippedAt = shippedAt;
    let normalizedDeliveredAt = deliveredAt;

    if (
      !normalizedShippedAt &&
      (input.status === shipment_status.shipped ||
        input.status === shipment_status.in_transit ||
        input.status === shipment_status.delivered)
    ) {
      normalizedShippedAt = now;
    }

    if (!normalizedDeliveredAt && input.status === shipment_status.delivered) {
      normalizedDeliveredAt = now;
    }

    return { shippedAt: normalizedShippedAt, deliveredAt: normalizedDeliveredAt };
  }

  async create(dto: CreateShipmentDto, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      this.assertOrderMutable(order.status);

      const status = dto.status ?? shipment_status.pending;
      const { shippedAt, deliveredAt } = this.normalizeDates({
        status,
        shippedAt: dto.shippedAt,
        deliveredAt: dto.deliveredAt,
      });

      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          status,
          carrier: dto.carrier ?? null,
          trackingNumber: dto.trackingNumber ?? null,
          trackingUrl: dto.trackingUrl ?? null,
          serviceLevel: dto.serviceLevel ?? null,
          shippedAt,
          deliveredAt,
          estimatedDeliveryAt: this.parseDate(dto.estimatedDeliveryAt),
          metadata: this.toJson(dto.metadata),
        },
      });

      await this.applyOrderStatus(tx, order.id, status);

      return tx.shipment.findUnique({
        where: { id: shipment.id },
        include: { events: true },
      });
    }).then((shipment) => {
      if (status === shipment_status.shipped) {
        void this.notificationsService.dispatch('order.shipped', dto.orderId, {
          trackingNumber: dto.trackingNumber ?? undefined,
          trackingUrl: dto.trackingUrl ?? undefined,
          carrier: dto.carrier ?? undefined,
          estimatedDelivery: dto.estimatedDeliveryAt ?? undefined,
        });
      } else if (status === shipment_status.delivered) {
        void this.notificationsService.dispatch('order.delivered', dto.orderId);
      }
      return shipment;
    });
  }

  async update(id: string, dto: UpdateShipmentDto, context?: AuditContext) {
    let previousStatus: shipment_status | undefined;
    let orderId: string | undefined;
    let existingTracking: { trackingNumber: string | null; trackingUrl: string | null; carrier: string | null } | undefined;

    const shipment = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const existing = await tx.shipment.findUnique({
        where: { id },
        include: { order: { select: { id: true, status: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Shipment not found');
      }

      this.assertOrderMutable(existing.order.status);

      previousStatus = existing.status;
      orderId = existing.order.id;
      existingTracking = { trackingNumber: existing.trackingNumber, trackingUrl: existing.trackingUrl, carrier: existing.carrier };

      const status = dto.status ?? existing.status;
      const { shippedAt, deliveredAt } = this.normalizeDates({
        status,
        shippedAt: dto.shippedAt,
        deliveredAt: dto.deliveredAt,
        existing: {
          shippedAt: existing.shippedAt,
          deliveredAt: existing.deliveredAt,
        },
      });

      const updated = await tx.shipment.update({
        where: { id },
        data: {
          status,
          carrier: dto.carrier ?? undefined,
          trackingNumber: dto.trackingNumber ?? undefined,
          trackingUrl: dto.trackingUrl ?? undefined,
          serviceLevel: dto.serviceLevel ?? undefined,
          shippedAt,
          deliveredAt,
          estimatedDeliveryAt:
            dto.estimatedDeliveryAt === undefined
              ? undefined
              : this.parseDate(dto.estimatedDeliveryAt),
          metadata: this.toJson(dto.metadata),
        },
      });

      await this.applyOrderStatus(tx, existing.order.id, status);

      return tx.shipment.findUnique({
        where: { id: updated.id },
        include: { events: true },
      });
    });

    const newStatus = dto.status ?? previousStatus;
    if (orderId && newStatus === shipment_status.shipped && previousStatus !== shipment_status.shipped) {
      void this.notificationsService.dispatch('order.shipped', orderId, {
        trackingNumber: dto.trackingNumber ?? existingTracking?.trackingNumber ?? undefined,
        trackingUrl: dto.trackingUrl ?? existingTracking?.trackingUrl ?? undefined,
        carrier: dto.carrier ?? existingTracking?.carrier ?? undefined,
      });
    } else if (orderId && newStatus === shipment_status.delivered && previousStatus !== shipment_status.delivered) {
      void this.notificationsService.dispatch('order.delivered', orderId);
    }

    return shipment;
  }

  async addEvent(id: string, dto: CreateShipmentEventDto, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      const shipment = await tx.shipment.findUnique({
        where: { id },
        include: { order: { select: { id: true, status: true } } },
      });

      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }

      this.assertOrderMutable(shipment.order.status);

      const { shippedAt, deliveredAt } = this.normalizeDates({
        status: dto.status,
        existing: {
          shippedAt: shipment.shippedAt,
          deliveredAt: shipment.deliveredAt,
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: dto.status,
          message: dto.message ?? null,
          location: dto.location ?? null,
          occurredAt: this.parseDate(dto.occurredAt) ?? new Date(),
          metadata: this.toJson(dto.metadata),
        },
      });

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: dto.status,
          shippedAt,
          deliveredAt,
        },
      });

      await this.applyOrderStatus(tx, shipment.order.id, dto.status);

      return tx.shipment.findUnique({
        where: { id: shipment.id },
        include: { events: true },
      });
    });
  }

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async findAll(query: QueryShipmentDto) {
    const where: Prisma.ShipmentWhereInput = {};
    if (query.orderId) {
      where.orderId = query.orderId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.trackingNumber) {
      where.trackingNumber = { contains: query.trackingNumber, mode: 'insensitive' };
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data;
      try {
        data = await this.prisma.shipment.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: { events: true },
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
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { events: true },
      }),
      this.prisma.shipment.count({ where }),
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
}
