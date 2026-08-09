import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { OFFERS_QUEUE_NAME } from './offers.queue.constants';
import { OffersService } from './offers.service';

@Injectable()
export class OffersQueueWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private readonly logger = new Logger(OffersQueueWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly offersService: OffersService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Offers worker disabled.');
      return;
    }

    this.worker = new Worker(
      OFFERS_QUEUE_NAME,
      async (job) => {
        if (job.name === 'offer.acceptance_timeout') {
          const offerId = job.data?.offerId as string | undefined;
          if (offerId) {
            await this.offersService.releaseReservationIfExpired(offerId);
          }
          return;
        }

        if (job.name === 'offer.review_timeout') {
          const offerId = job.data?.offerId as string | undefined;
          if (offerId) {
            await this.offersService.expireIfStillPending(offerId);
          }
          return;
        }

        this.logger.log(`Offer job received. name=${job.name} id=${job.id} offerId=${job.data?.offerId}`);
      },
      { connection: parseRedisUrl(redisUrl) },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Offer job failed. id=${job?.id} name=${job?.name} error=${error instanceof Error ? error.message : String(error)}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Offers worker error: ${error instanceof Error ? error.message : String(error)}`);
    });

    this.logger.log('Offers worker started.');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
