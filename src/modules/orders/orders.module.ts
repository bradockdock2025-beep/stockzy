import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrdersController } from './orders.controller';
import { OrdersCustomerController } from './orders.customer.controller';
import { OrdersGuestController } from './orders.guest.controller';
import { OrdersReportsController } from './orders.reports.controller';
import { OrdersService } from './orders.service';
import { OrdersQueueService } from './orders.queue.service';
import { OrdersQueueWorker } from './orders.queue.worker';
import { CustomersModule } from '../customers/customers.module';
import { CartModule } from '../cart/cart.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ShippingService } from './shipping.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';

@Module({
  imports: [DatabaseModule, CustomersModule, CartModule, RedisModule, PaymentsModule, NotificationsModule],
  controllers: [OrdersController, OrdersCustomerController, OrdersGuestController, ReceiptController, OrdersReportsController],
  providers: [OrdersService, OrdersQueueService, OrdersQueueWorker, ShippingService, ReceiptService],
  exports: [OrdersQueueService],
})
export class OrdersModule {}
