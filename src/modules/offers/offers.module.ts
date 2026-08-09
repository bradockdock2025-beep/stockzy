import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CustomersModule } from '../customers/customers.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OffersController, OffersGuestStatusController } from './offers.controller';
import { OffersCustomerController } from './offers.customer.controller';
import { OffersAdminController } from './offers.admin.controller';
import { OffersService } from './offers.service';
import { OffersQueueService } from './offers.queue.service';
import { OffersQueueWorker } from './offers.queue.worker';

@Module({
  imports: [DatabaseModule, CustomersModule, RedisModule, NotificationsModule],
  controllers: [OffersController, OffersGuestStatusController, OffersCustomerController, OffersAdminController],
  providers: [OffersService, OffersQueueService, OffersQueueWorker],
  exports: [OffersQueueService],
})
export class OffersModule {}
