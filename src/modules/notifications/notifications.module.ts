import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsService } from './notifications.service';
import { NotificationsQueueService } from './notifications.queue.service';
import { NotificationsWorker } from './notifications.worker';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [NotificationsService, NotificationsQueueService, NotificationsWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
