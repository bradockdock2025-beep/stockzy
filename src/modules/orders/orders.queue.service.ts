import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { ORDERS_QUEUE_NAME } from './orders.queue.constants';

@Injectable()
export class OrdersQueueService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private readonly logger = new Logger(OrdersQueueService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Orders queue disabled.');
      return;
    }

    this.queue = new Queue(ORDERS_QUEUE_NAME, {
      connection: parseRedisUrl(redisUrl),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    this.logger.log('Orders queue connected.');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async enqueueOrderCreated(orderId: string) {
    if (!this.queue) {
      this.logger.warn(`Orders queue not available. Skipping enqueue for order ${orderId}.`);
      return;
    }

    try {
      await this.queue.add('order.created', { orderId });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async enqueueReservationTimeout(orderId: string, delayMs: number) {
    if (!this.queue) {
      this.logger.warn(
        `Orders queue not available. Skipping reservation timeout for order ${orderId}.`,
      );
      return;
    }

    try {
      await this.queue.add(
        'order.reservation_timeout',
        { orderId },
        {
          delay: Math.max(delayMs, 0),
          jobId: `order_reservation_timeout__${orderId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue reservation timeout for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getJobCounts(): Promise<Record<string, number> | null> {
    if (!this.queue) {
      return null;
    }
    return this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
  }
}
