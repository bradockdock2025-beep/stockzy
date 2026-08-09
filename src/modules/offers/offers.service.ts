import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { offer_status, product_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OffersQueueService } from './offers.queue.service';
import { CreateGuestOfferDto } from './dto/create-guest-offer.dto';
import { CreateCustomerOfferDto } from './dto/create-customer-offer.dto';
import { RejectOfferDto } from './dto/reject-offer.dto';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Fase 1 do PLANO_MAKE_OFFER.md: sem auto-aceite (minOfferPercent) e sem
 * motor de concorrência/janela por escassez (§4.1) — toda oferta nasce
 * "pending" e é decidida manualmente pelo admin (regras §4.1-3). O aceite
 * reserva estoque com o mesmo timeout de expiração usado nos pedidos
 * pendentes, só que na fila `offers` em vez de `orders`.
 */
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly offersQueue: OffersQueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private badRequest(code: string, message: string, details?: Record<string, unknown>): never {
    throw new BadRequestException({ code, message, ...(details ?? {}) });
  }

  private getReviewWindowMs() {
    const raw = this.configService.get<string>('OFFER_REVIEW_HOURS');
    const parsed = raw ? Number(raw) : NaN;
    const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
    return hours * 60 * 60 * 1000;
  }

  private getCheckoutWindowMs() {
    const raw = this.configService.get<string>('OFFER_CHECKOUT_HOURS');
    const parsed = raw ? Number(raw) : NaN;
    const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
    return hours * 60 * 60 * 1000;
  }

  private async loadActiveVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, product: { status: product_status.active } },
      select: { id: true, price: true },
    });
    if (!variant) {
      throw new NotFoundException('Variant not found or unavailable');
    }
    return variant;
  }

  async createGuestOffer(variantId: string, dto: CreateGuestOfferDto) {
    const variant = await this.loadActiveVariant(variantId);
    const guestToken = randomUUID();
    const reviewWindowMs = this.getReviewWindowMs();

    const offer = await this.prisma.offer.create({
      data: {
        variantId: variant.id,
        guestEmail: dto.guestEmail,
        guestToken,
        listedPrice: variant.price,
        offeredPrice: dto.offeredPrice,
        locale: dto.locale ?? 'pt',
        status: offer_status.pending,
        expiresAt: new Date(Date.now() + reviewWindowMs),
      },
    });

    await this.offersQueue.enqueueReviewTimeout(offer.id, reviewWindowMs);
    void this.notificationsService.dispatchOfferInternal(offer.id);

    return {
      offerId: offer.id,
      status: offer.status,
      guestToken,
      expiresAt: offer.expiresAt,
    };
  }

  async createCustomerOffer(authUserId: string, dto: CreateCustomerOfferDto) {
    if (!authUserId) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Invalid customer');
    }

    const variant = await this.loadActiveVariant(dto.variantId);

    const existing = await this.prisma.offer.findFirst({
      where: {
        variantId: variant.id,
        customerId: customer.id,
        status: { in: [offer_status.pending, offer_status.pending_window, offer_status.accepted] },
      },
      select: { id: true },
    });
    if (existing) {
      this.badRequest('OFFER_ALREADY_PENDING', 'You already have an active offer for this item', {
        offerId: existing.id,
      });
    }

    const reviewWindowMs = this.getReviewWindowMs();
    const offer = await this.prisma.offer.create({
      data: {
        variantId: variant.id,
        customerId: customer.id,
        listedPrice: variant.price,
        offeredPrice: dto.offeredPrice,
        locale: dto.locale ?? 'pt',
        status: offer_status.pending,
        expiresAt: new Date(Date.now() + reviewWindowMs),
      },
    });

    await this.offersQueue.enqueueReviewTimeout(offer.id, reviewWindowMs);
    void this.notificationsService.dispatchOfferInternal(offer.id);

    return {
      offerId: offer.id,
      status: offer.status,
      expiresAt: offer.expiresAt,
    };
  }

  async findForGuest(id: string, guestToken: string) {
    if (!guestToken) {
      throw new UnauthorizedException('Missing token');
    }
    const offer = await this.prisma.offer.findFirst({ where: { id, guestToken } });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async findForCustomer(id: string, authUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    const offer = await this.prisma.offer.findFirst({
      where: { id, customerId: customer?.id ?? '__none__' },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async listForAdmin(status?: offer_status) {
    return this.prisma.offer.findMany({
      where: { status: status ?? offer_status.pending },
      orderBy: { createdAt: 'asc' },
      include: {
        variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async accept(offerId: string, adminUserId: string | null) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [offer] = await tx.$queryRaw<
        Array<{ id: string; variant_id: string; status: offer_status; expires_at: Date }>
      >`SELECT id, variant_id, status, expires_at FROM offers WHERE id = ${offerId} FOR UPDATE;`;

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }
      if (offer.status !== offer_status.pending) {
        this.badRequest('OFFER_NOT_PENDING', 'Offer is not awaiting review', { status: offer.status });
      }
      if (offer.expires_at < new Date()) {
        const updated = await tx.offer.update({ where: { id: offerId }, data: { status: offer_status.expired } });
        return { outcome: 'expired' as const, updated };
      }

      const [inv] = await tx.$queryRaw<Array<{ stock_quantity: number; reserved_quantity: number }>>`
        SELECT stock_quantity, reserved_quantity FROM inventory WHERE variant_id = ${offer.variant_id} FOR UPDATE;
      `;
      const available = inv ? Number(inv.stock_quantity) - Number(inv.reserved_quantity) : 0;

      if (available < 1) {
        const updated = await tx.offer.update({
          where: { id: offerId },
          data: {
            status: offer_status.rejected,
            rejectionReason: 'sold_out',
            respondedAt: new Date(),
            respondedBy: adminUserId,
          },
        });
        return { outcome: 'sold_out' as const, updated };
      }

      await tx.$executeRaw`
        UPDATE inventory SET reserved_quantity = reserved_quantity + 1 WHERE variant_id = ${offer.variant_id};
      `;

      const checkoutDeadline = new Date(Date.now() + this.getCheckoutWindowMs());
      const updated = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: offer_status.accepted,
          respondedAt: new Date(),
          respondedBy: adminUserId,
          expiresAt: checkoutDeadline,
        },
      });

      return { outcome: 'accepted' as const, updated, checkoutDeadline };
    });

    // As atualizações acima (expired/sold_out/accepted) já foram commitadas —
    // o erro correspondente só é lançado DEPOIS da transação, senão o rollback
    // desfaz a própria atualização que estava registrando o motivo da rejeição.
    if (result.outcome === 'expired') {
      this.badRequest('OFFER_EXPIRED', 'Offer review window has expired');
    }
    if (result.outcome === 'sold_out') {
      void this.notificationsService.dispatchOfferDecision('offer.rejected', offerId);
      this.badRequest('OFFER_SOLD_OUT', 'No stock left to accept this offer');
    }

    await this.offersQueue.enqueueAcceptanceTimeout(
      offerId,
      result.checkoutDeadline.getTime() - Date.now(),
    );
    void this.notificationsService.dispatchOfferDecision('offer.accepted', offerId);

    return result.updated;
  }

  async reject(offerId: string, adminUserId: string | null, dto: RejectOfferDto) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== offer_status.pending) {
      this.badRequest('OFFER_NOT_PENDING', 'Offer is not awaiting review', { status: offer.status });
    }

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        status: offer_status.rejected,
        rejectionReason: dto.reason ?? 'below_minimum',
        respondedAt: new Date(),
        respondedBy: adminUserId,
      },
    });

    void this.notificationsService.dispatchOfferDecision('offer.rejected', offerId);

    return updated;
  }

  /**
   * Job de timeout (offer.review_timeout) — se ninguém do time revisar a
   * tempo, a oferta expira sozinha em vez de ficar "pending" indefinidamente.
   */
  async expireIfStillPending(offerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer || offer.status !== offer_status.pending) {
        return offer;
      }
      if (offer.expiresAt > new Date()) {
        return offer;
      }

      return tx.offer.update({ where: { id: offerId }, data: { status: offer_status.expired } });
    });
  }

  /**
   * Job de timeout (offer.acceptance_timeout) — mesma mecânica de
   * releaseReservationIfPending do OrdersService, aplicada à unidade
   * reservada na aceitação de uma oferta que o cliente não converteu em
   * pedido a tempo.
   */
  async releaseReservationIfExpired(offerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer || offer.status !== offer_status.accepted) {
        return offer;
      }
      if (offer.expiresAt > new Date()) {
        return offer;
      }

      await tx.$executeRaw`
        UPDATE inventory SET reserved_quantity = GREATEST(reserved_quantity - 1, 0) WHERE variant_id = ${offer.variantId};
      `;

      return tx.offer.update({ where: { id: offerId }, data: { status: offer_status.expired } });
    });
  }
}
