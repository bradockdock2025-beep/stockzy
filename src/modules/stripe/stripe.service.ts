import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';

@Injectable()
export class StripeService {
  private _stripe: InstanceType<typeof Stripe> | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {}

  private getClient(): InstanceType<typeof Stripe> {
    if (this._stripe) {
      return this._stripe;
    }
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not configured');
    }
    this._stripe = new Stripe(secretKey, {
      apiVersion: '2026-05-27.dahlia',
    });
    return this._stripe;
  }

  get publishableKey(): string {
    const key = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (!key) {
      this.logger.warn('STRIPE_PUBLISHABLE_KEY is not configured');
    }
    return key ?? '';
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }) {
    return this.getClient().paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      metadata: params.metadata ?? {},
      automatic_payment_methods: { enabled: true },
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.getClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  async retrievePaymentIntent(id: string) {
    return this.getClient().paymentIntents.retrieve(id);
  }

  toStripeAmount(amount: Prisma.Decimal | number, currency: string): number {
    const zeroDecimalCurrencies = new Set([
      'bif', 'clp', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
    ]);
    const value = typeof amount === 'number' ? amount : amount.toNumber();
    if (zeroDecimalCurrencies.has(currency.toLowerCase())) {
      return Math.round(value);
    }
    return Math.round(value * 100);
  }
}
