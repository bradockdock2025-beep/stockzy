import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsQueueService } from './notifications.queue.service';

export type NotificationEvent =
  | 'order.created'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'presale.confirmed'
  | 'presale.fulfilled'
  | 'presale.cancelled';

const EVENT_TEMPLATES: Record<NotificationEvent, string> = {
  'order.created': 'order-created',
  'payment.confirmed': 'payment-confirmed',
  'payment.failed': 'payment-failed',
  'order.shipped': 'order-shipped',
  'order.delivered': 'order-delivered',
  'order.cancelled': 'order-cancelled',
  'presale.confirmed': 'presale-confirmed',
  'presale.fulfilled': 'presale-fulfilled',
  'presale.cancelled': 'presale-cancelled',
};

type SupportedLocale = 'pt' | 'fr' | 'en' | 'es';

const EVENT_SUBJECTS: Record<SupportedLocale, Record<NotificationEvent, string>> = {
  pt: {
    'order.created': 'Pedido confirmado',
    'payment.confirmed': 'Pagamento aprovado',
    'payment.failed': 'Problema com o pagamento',
    'order.shipped': 'O seu pedido foi enviado!',
    'order.delivered': 'Pedido entregue',
    'order.cancelled': 'Pedido cancelado',
    'presale.confirmed': 'Pré-compra confirmada!',
    'presale.fulfilled': 'O seu produto chegou — pedido em processamento!',
    'presale.cancelled': 'Pré-compra cancelada',
  },
  fr: {
    'order.created': 'Commande confirmée',
    'payment.confirmed': 'Paiement approuvé',
    'payment.failed': 'Problème de paiement',
    'order.shipped': 'Votre commande a été expédiée !',
    'order.delivered': 'Commande livrée',
    'order.cancelled': 'Commande annulée',
    'presale.confirmed': 'Pré-achat confirmé !',
    'presale.fulfilled': 'Votre produit est arrivé — commande en cours !',
    'presale.cancelled': 'Pré-achat annulé',
  },
  en: {
    'order.created': 'Order confirmed',
    'payment.confirmed': 'Payment approved',
    'payment.failed': 'Payment issue',
    'order.shipped': 'Your order has been shipped!',
    'order.delivered': 'Order delivered',
    'order.cancelled': 'Order cancelled',
    'presale.confirmed': 'Pre-order confirmed!',
    'presale.fulfilled': 'Your product arrived — order created!',
    'presale.cancelled': 'Pre-order cancelled',
  },
  es: {
    'order.created': 'Pedido confirmado',
    'payment.confirmed': 'Pago aprobado',
    'payment.failed': 'Problema con el pago',
    'order.shipped': '¡Tu pedido fue enviado!',
    'order.delivered': 'Pedido entregado',
    'order.cancelled': 'Pedido cancelado',
    'presale.confirmed': '¡Precompra confirmada!',
    'presale.fulfilled': '¡Tu producto llegó — pedido en proceso!',
    'presale.cancelled': 'Precompra cancelada',
  },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly frontendUrl: string;
  private readonly apiUrl: string;
  private readonly receiptSecret: string;
  private readonly internalEmail: string;
  private readonly supportEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsQueue: NotificationsQueueService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    this.apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3000';
    this.receiptSecret = this.configService.get<string>('PAYMENT_CONFIRMATION_SECRET') ?? '';
    this.internalEmail = this.configService.get<string>('INTERNAL_NOTIFY_EMAIL') ?? 'teams@example.com';
    this.supportEmail = this.configService.get<string>('MAIL_REPLY_TO') ?? 'support@example.com';
  }

  private formatDateTime(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()} ${hh}:${min}`;
  }

  private buildReceiptUrl(orderId: string): string {
    const token = createHmac('sha256', this.receiptSecret).update(orderId).digest('hex');
    return `${this.apiUrl}/orders/${orderId}/receipt?token=${token}`;
  }

  async dispatch(
    eventKey: NotificationEvent,
    orderId: string,
    extraPayload: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { email: true, firstName: true } },
          items: {
            select: {
              productName: true, quantity: true, unitPrice: true, totalPrice: true,
              variantId: true,
              variant: {
                select: {
                  expectedAvailableAt: true,
                  presalePrice: true,
                  price: true,
                  facetValues: {
                    select: { facetValue: { select: { label: true, facet: { select: { key: true, name: true } } } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found, skipping notification ${eventKey}`);
        return;
      }

      const addr = order.shippingAddress as Record<string, string> | null;
      const recipientEmail = order.customer?.email ?? addr?.email;

      if (!recipientEmail) {
        this.logger.warn(`Customer email missing for order ${orderId}, skipping notification ${eventKey}`);
        return;
      }

      const locale: SupportedLocale = (order.locale as SupportedLocale) ?? 'pt';

      let presaleExtra: Record<string, unknown> = {};
      if (eventKey === 'presale.confirmed' || eventKey === 'presale.fulfilled' || eventKey === 'presale.cancelled') {
        const firstVariant = order.items[0]?.variant as { expectedAvailableAt?: Date | null; presalePrice?: unknown; price?: unknown } | undefined;
        if (firstVariant?.expectedAvailableAt) {
          const d = firstVariant.expectedAvailableAt;
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          presaleExtra.expectedAvailableAt = `${mm}/${d.getFullYear()}`;
        }
        if (firstVariant) {
          presaleExtra.presalePrice = Number((firstVariant.presalePrice as number | null) ?? firstVariant.price).toFixed(2);
          presaleExtra.originalPrice = Number(firstVariant.price).toFixed(2);
        }
      }

      const context = {
        firstName: order.customer?.firstName ?? addr?.name ?? 'Cliente',
        orderNumber: order.orderNumber,
        orderId: order.id,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice).toFixed(2),
          totalPrice: Number(item.totalPrice).toFixed(2),
          attributes: item.variant?.facetValues
            ?.filter((fv) => fv.facetValue.facet.key !== 'gender')
            ?.map((fv) => `${fv.facetValue.facet.name}: ${fv.facetValue.label}`)
            .join(' · ') ?? '',
        })),
        subtotal: Number(order.subtotal).toFixed(2),
        shippingAmount: Number(order.shippingAmount).toFixed(2),
        totalAmount: Number(order.totalAmount).toFixed(2),
        shippingStreet: addr?.street ?? '',
        shippingCity: addr?.city ?? '',
        shippingState: addr?.state ?? '',
        shippingZipcode: addr?.zipcode ?? '',
        shippingCountry: addr?.country ?? '',
        orderUrl: eventKey === 'order.shipped'
          ? `${this.frontendUrl}/account/orders/${order.id}/tracking`
          : `${this.frontendUrl}/account/orders/${order.id}`,
        storeUrl: this.frontendUrl,
        reviewUrl: this.frontendUrl,
        receiptUrl: this.buildReceiptUrl(order.id),
        supportEmail: this.supportEmail,
        year: new Date().getFullYear(),
        ...presaleExtra,
        ...extraPayload,
      };

      const jobId = `${eventKey.replace(/\./g, '_')}__${orderId}`;

      await this.notificationsQueue.enqueueEmail(
        {
          to: recipientEmail,
          subject: `${EVENT_SUBJECTS[locale][eventKey]} — ${order.orderNumber}`,
          template: `${EVENT_TEMPLATES[eventKey]}.${locale}.hbs`,
          context,
        },
        jobId,
      );

      this.logger.log(`Notification enqueued: event=${eventKey} order=${order.orderNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch notification ${eventKey} for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async dispatchInternal(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { email: true, firstName: true, lastName: true, phoneNumber: true } },
          items: {
            select: {
              productName: true, sku: true, quantity: true, unitPrice: true, totalPrice: true,
              variant: {
                select: {
                  expectedAvailableAt: true,
                  facetValues: {
                    select: { facetValue: { select: { label: true, facet: { select: { key: true, name: true } } } } },
                  },
                },
              },
            },
          },
          payment: { select: { method: true } },
        },
      });

      if (!order) return;

      const addr = order.shippingAddress as Record<string, string> | null;
      const isPresale = order.status === 'presale';
      const isGuest = !order.customer;

      const firstVariantDate = order.items[0]?.variant?.expectedAvailableAt as Date | null | undefined;
      const expectedAvailableAt = firstVariantDate
        ? `${String(firstVariantDate.getMonth() + 1).padStart(2, '0')}/${firstVariantDate.getFullYear()}`
        : null;

      const customerName = isGuest
        ? addr?.name || 'Guest'
        : `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim() || 'Cliente';
      const customerEmail = order.customer?.email ?? addr?.email ?? '';
      const customerPhone = isGuest
        ? ((order as Record<string, unknown>).guestPhone as string ?? '')
        : (order.customer?.phoneNumber ?? '');

      await this.notificationsQueue.enqueueEmail({
        to: this.internalEmail,
        subject: isGuest
          ? `Nova venda Guest — ${order.orderNumber}`
          : isPresale
            ? `Nova pré-compra — ${order.orderNumber}`
            : `Nova venda — ${order.orderNumber}`,
        template: 'order-internal.hbs',
        context: {
          orderNumber: order.orderNumber,
          isPresale,
          isGuest,
          expectedAvailableAt,
          customerName,
          customerEmail,
          customerPhone,
          paymentMethod: order.payment?.method ?? '',
          shippingStreet: addr?.street ?? '',
          shippingCity: addr?.city ?? '',
          shippingState: addr?.state ?? '',
          shippingZipcode: addr?.zipcode ?? '',
          shippingCountry: addr?.country ?? '',
          items: order.items.map((item) => ({
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            totalPrice: Number(item.totalPrice).toFixed(2),
            attributes: item.variant?.facetValues
              ?.filter((fv) => fv.facetValue.facet.key !== 'gender')
              ?.map((fv) => `${fv.facetValue.facet.name}: ${fv.facetValue.label}`)
              .join(' · ') ?? '',
          })),
          subtotal: Number(order.subtotal).toFixed(2),
          shippingAmount: Number(order.shippingAmount).toFixed(2),
          totalAmount: Number(order.totalAmount).toFixed(2),
          receiptUrl: this.buildReceiptUrl(order.id),
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Internal notification sent for order ${order.orderNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch internal notification for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async dispatchPasswordReset(input: {
    to: string;
    firstName: string;
    locale: SupportedLocale;
    resetLink: string;
  }): Promise<void> {
    const subjects: Record<SupportedLocale, string> = {
      pt: 'Redefinição de password — Stockzy',
      fr: 'Réinitialisation du mot de passe — Stockzy',
      en: 'Password reset — Stockzy',
      es: 'Restablecimiento de contraseña — Stockzy',
    };
    try {
      await this.notificationsQueue.enqueueEmail({
        to: input.to,
        subject: subjects[input.locale],
        template: `password-reset.${input.locale}.hbs`,
        context: {
          firstName: input.firstName,
          resetLink: input.resetLink,
          supportEmail: this.supportEmail,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Password reset email enqueued to ${input.to}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue password reset email to ${input.to}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async dispatchPasswordResetConfirmed(input: {
    to: string;
    firstName: string;
    locale: SupportedLocale;
  }): Promise<void> {
    const subjects: Record<SupportedLocale, string> = {
      pt: 'Password alterada com sucesso — Stockzy',
      fr: 'Mot de passe modifié — Stockzy',
      en: 'Password changed successfully — Stockzy',
      es: 'Contraseña cambiada — Stockzy',
    };
    try {
      await this.notificationsQueue.enqueueEmail({
        to: input.to,
        subject: subjects[input.locale],
        template: `password-reset-confirmed.${input.locale}.hbs`,
        context: {
          firstName: input.firstName,
          changedAt: new Date().toLocaleString(`${input.locale}-PT`, { dateStyle: 'short', timeStyle: 'short' }),
          supportEmail: this.supportEmail,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Password reset confirmation email enqueued to ${input.to}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue password reset confirmation email to ${input.to}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async dispatchWelcome(input: {
    to: string;
    locale: SupportedLocale;
  }): Promise<void> {
    const subjects: Record<SupportedLocale, string> = {
      pt: 'Bem-vindo à Stockzy',
      fr: 'Bienvenue chez Stockzy',
      en: 'Welcome to Stockzy',
      es: 'Bienvenido a Stockzy',
    };
    try {
      await this.notificationsQueue.enqueueEmail({
        to: input.to,
        subject: subjects[input.locale],
        template: `welcome.${input.locale}.hbs`,
        context: {
          supportEmail: this.supportEmail,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Welcome email enqueued to ${input.to}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue welcome email to ${input.to}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async dispatchInternalCancelled(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { email: true, firstName: true, lastName: true } },
          items: {
            select: {
              productName: true, quantity: true, unitPrice: true, totalPrice: true,
              variant: {
                select: {
                  facetValues: {
                    select: { facetValue: { select: { label: true, facet: { select: { key: true, name: true } } } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) return;

      const addr = order.shippingAddress as Record<string, string> | null;

      await this.notificationsQueue.enqueueEmail({
        to: this.internalEmail,
        subject: `Pedido cancelado — ${order.orderNumber}`,
        template: 'order-cancelled-internal.hbs',
        context: {
          orderNumber: order.orderNumber,
          customerName: `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim() || 'Cliente',
          customerEmail: order.customer?.email ?? '',
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice).toFixed(2),
            totalPrice: Number(item.totalPrice).toFixed(2),
            attributes: item.variant?.facetValues
              ?.filter((fv) => fv.facetValue.facet.key !== 'gender')
              ?.map((fv) => `${fv.facetValue.facet.name}: ${fv.facetValue.label}`)
              .join(' · ') ?? '',
          })),
          subtotal: Number(order.subtotal).toFixed(2),
          shippingAmount: Number(order.shippingAmount).toFixed(2),
          totalAmount: Number(order.totalAmount).toFixed(2),
          shippingStreet: addr?.street ?? '',
          shippingCity: addr?.city ?? '',
          shippingState: addr?.state ?? '',
          shippingZipcode: addr?.zipcode ?? '',
          shippingCountry: addr?.country ?? '',
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Internal cancellation notification sent for order ${order.orderNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch internal cancellation notification for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Notifica o time interno que uma oferta nova chegou pra revisão — sem
   * isto, "revisão manual" (Fase 1 do PLANO_MAKE_OFFER.md) não tem gatilho
   * nenhum, ninguém saberia que existe algo esperando no /admin/offers.
   */
  async dispatchOfferInternal(offerId: string): Promise<void> {
    try {
      const offer = await this.prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          variant: { select: { sku: true, product: { select: { name: true } } } },
          customer: { select: { email: true, firstName: true, lastName: true } },
        },
      });
      if (!offer) return;

      const percentOfListed = Math.round(
        (Number(offer.offeredPrice) / Number(offer.listedPrice)) * 100,
      );
      const customerName = offer.customer
        ? `${offer.customer.firstName ?? ''} ${offer.customer.lastName ?? ''}`.trim() || 'Cliente'
        : 'Guest';
      const customerEmail = offer.customer?.email ?? offer.guestEmail ?? '';

      await this.notificationsQueue.enqueueEmail(
        {
          to: this.internalEmail,
          subject: `Nova oferta — ${offer.variant.product.name} (${percentOfListed}% do preço)`,
          template: 'offer-internal.hbs',
          context: {
            productName: offer.variant.product.name,
            sku: offer.variant.sku,
            listedPrice: Number(offer.listedPrice).toFixed(2),
            offeredPrice: Number(offer.offeredPrice).toFixed(2),
            percentOfListed,
            isGuest: !offer.customer,
            customerName,
            customerEmail,
            expiresAt: this.formatDateTime(offer.expiresAt),
            year: new Date().getFullYear(),
          },
        },
        `offer_internal__${offer.id}`,
      );

      this.logger.log(`Internal offer notification sent for offer ${offer.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch internal offer notification for offer ${offerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Aceite/rejeição de oferta pro cliente (guest ou autenticado) — a janela
   * de checkout do aceite é curta (§4, regra 2), então avisar por email é
   * o que faz o cliente voltar a tempo de finalizar a compra.
   */
  async dispatchOfferDecision(
    eventKey: 'offer.accepted' | 'offer.rejected',
    offerId: string,
  ): Promise<void> {
    const subjects: Record<SupportedLocale, Record<'offer.accepted' | 'offer.rejected', string>> = {
      pt: { 'offer.accepted': 'Sua oferta foi aceite!', 'offer.rejected': 'Sobre a sua oferta' },
      fr: { 'offer.accepted': 'Votre offre a été acceptée !', 'offer.rejected': 'À propos de votre offre' },
      en: { 'offer.accepted': 'Your offer was accepted!', 'offer.rejected': 'About your offer' },
      es: { 'offer.accepted': '¡Tu oferta fue aceptada!', 'offer.rejected': 'Sobre tu oferta' },
    };
    const templates: Record<'offer.accepted' | 'offer.rejected', string> = {
      'offer.accepted': 'offer-accepted',
      'offer.rejected': 'offer-rejected',
    };

    try {
      const offer = await this.prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          variant: { select: { product: { select: { name: true } } } },
          customer: { select: { email: true, firstName: true } },
        },
      });
      if (!offer) return;

      const recipientEmail = offer.customer?.email ?? offer.guestEmail;
      if (!recipientEmail) {
        this.logger.warn(`No email on offer ${offerId}, skipping ${eventKey} notification`);
        return;
      }

      const locale = (offer.locale as SupportedLocale) ?? 'pt';
      const rejectionMessages: Record<SupportedLocale, Record<string, string>> = {
        pt: { sold_out: 'O item esgotou antes da sua oferta ser avaliada.', outbid: 'Outra oferta de valor mais alto foi aceite no lugar da sua.', below_minimum: 'O valor oferecido não foi suficiente desta vez.', other: 'A sua oferta não foi aceite desta vez.' },
        fr: { sold_out: "L'article a été épuisé avant l'évaluation de votre offre.", outbid: 'Une offre plus élevée a été acceptée à la place de la vôtre.', below_minimum: "Le montant proposé n'était pas suffisant cette fois-ci.", other: "Votre offre n'a pas été acceptée cette fois-ci." },
        en: { sold_out: 'The item sold out before your offer could be reviewed.', outbid: 'A higher offer was accepted instead of yours.', below_minimum: 'The offered amount was not enough this time.', other: 'Your offer was not accepted this time.' },
        es: { sold_out: 'El artículo se agotó antes de evaluar tu oferta.', outbid: 'Se aceptó otra oferta de mayor valor en lugar de la tuya.', below_minimum: 'El monto ofrecido no fue suficiente esta vez.', other: 'Tu oferta no fue aceptada esta vez.' },
      };

      await this.notificationsQueue.enqueueEmail(
        {
          to: recipientEmail,
          subject: `${subjects[locale][eventKey]} — ${offer.variant.product.name}`,
          template: `${templates[eventKey]}.${locale}.hbs`,
          context: {
            firstName: offer.customer?.firstName ?? 'Cliente',
            productName: offer.variant.product.name,
            listedPrice: Number(offer.listedPrice).toFixed(2),
            offeredPrice: Number(offer.offeredPrice).toFixed(2),
            checkoutDeadline: this.formatDateTime(offer.expiresAt),
            rejectionMessage: rejectionMessages[locale][offer.rejectionReason ?? 'other'],
            storeUrl: this.frontendUrl,
            supportEmail: this.supportEmail,
            year: new Date().getFullYear(),
          },
        },
        `${eventKey.replace(/\./g, '_')}__${offer.id}`,
      );

      this.logger.log(`Offer notification enqueued: event=${eventKey} offer=${offer.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch ${eventKey} for offer ${offerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
