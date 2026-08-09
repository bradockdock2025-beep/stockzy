import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { NOTIFICATIONS_QUEUE_NAME } from './notifications.queue.constants';

export interface EmailJobPayload {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private readonly logger = new Logger(NotificationsQueueService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Notifications queue disabled.');
      return;
    }

    this.queue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: parseRedisUrl(redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    this.logger.log('Notifications queue connected.');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async enqueueEmail(payload: EmailJobPayload, jobId?: string): Promise<void> {
    if (!this.queue) {
      this.logger.warn('Notifications queue not available. Skipping email enqueue.');
      return;
    }

    try {
      await this.queue.add('send.email', payload, jobId ? { jobId } : undefined);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue email to ${payload.to}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
