import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import * as Sentry from '@sentry/node';
import { Public } from '../../common/decorators/public.decorator';
import { StripeService } from '../stripe/stripe.service';
import { PaymentsService } from './payments.service';

@Public()
@SkipThrottle()
@Controller('payments/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody: Buffer | undefined = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: ReturnType<StripeService['constructWebhookEvent']>;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook signature verification failed: ${msg}`);
      throw new BadRequestException('Invalid signature');
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const intent = event.data.object as { id: string; shipping?: unknown; receipt_email?: string | null };
          await this.paymentsService.handleStripePaymentSucceeded(intent.id, intent.shipping as never, intent.receipt_email);
          break;
        }
        case 'payment_intent.payment_failed': {
          const intent = event.data.object as { id: string };
          await this.paymentsService.handleStripePaymentFailed(intent.id);
          break;
        }
        default:
          this.logger.debug(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error handling Stripe webhook ${event.type}: ${msg}`, stack);
      Sentry.captureException(err, { extra: { eventType: event.type } });
      // Return 200 so Stripe does not retry
    }

    return { received: true };
  }
}
