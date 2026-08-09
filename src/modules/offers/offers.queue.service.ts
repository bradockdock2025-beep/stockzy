import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { OFFERS_QUEUE_NAME } from './offers.queue.constants';

@Injectable()
export class OffersQueueService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private readonly logger = new Logger(OffersQueueService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Offers queue disabled.');
      return;
    }

    this.queue = new Queue(OFFERS_QUEUE_NAME, {
      connection: parseRedisUrl(redisUrl),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    this.logger.log('Offers queue connected.');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  /**
   * Janela de checkout depois do aceite manual (regra 2 do §4 do
   * PLANO_MAKE_OFFER.md) — se o cliente não finalizar a compra a tempo,
   * libera a unidade reservada. Mesmo padrão de order.reservation_timeout.
   */
  async enqueueAcceptanceTimeout(offerId: string, delayMs: number) {
    if (!this.queue) {
      this.logger.warn(`Offers queue not available. Skipping acceptance timeout for offer ${offerId}.`);
      return;
    }

    try {
      await this.queue.add(
        'offer.acceptance_timeout',
        { offerId },
        {
          delay: Math.max(delayMs, 0),
          jobId: `offer_acceptance_timeout__${offerId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue acceptance timeout for offer ${offerId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Janela de revisão manual (§4, regra 1) — se nenhum admin decidir a
   * tempo, expira sozinha em vez de ficar "pending" pra sempre esperando
   * alguém abrir o painel.
   */
  async enqueueReviewTimeout(offerId: string, delayMs: number) {
    if (!this.queue) {
      this.logger.warn(`Offers queue not available. Skipping review timeout for offer ${offerId}.`);
      return;
    }

    try {
      await this.queue.add(
        'offer.review_timeout',
        { offerId },
        {
          delay: Math.max(delayMs, 0),
          jobId: `offer_review_timeout__${offerId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue review timeout for offer ${offerId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
