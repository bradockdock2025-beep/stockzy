import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { ORDERS_QUEUE_NAME } from './orders.queue.constants';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersQueueWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private readonly logger = new Logger(OrdersQueueWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Orders worker disabled.');
      return;
    }

    this.worker = new Worker(
      ORDERS_QUEUE_NAME,
      async (job) => {
        if (job.name === 'order.reservation_timeout') {
          const orderId = job.data?.orderId as string | undefined;
          if (orderId) {
            await this.ordersService.releaseReservationIfPending(orderId);
          }
          return;
        }

        this.logger.log(
          `Order job received. name=${job.name} id=${job.id} orderId=${job.data?.orderId}`,
        );
      },
      { connection: parseRedisUrl(redisUrl) },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Order job failed. id=${job?.id} name=${job?.name} error=${error instanceof Error ? error.message : String(error)}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Orders worker error: ${error instanceof Error ? error.message : String(error)}`);
    });

    this.logger.log('Orders worker started.');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
