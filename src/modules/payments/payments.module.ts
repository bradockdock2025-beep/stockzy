import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { StripeModule } from '../stripe/stripe.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsService } from './payments.service';
import { PaymentsAdminController } from './payments.admin.controller';
import { PaymentsCustomerController } from './payments.customer.controller';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [DatabaseModule, ConfigModule, RedisModule, AuditModule, CustomersModule, StripeModule, NotificationsModule],
  controllers: [PaymentsAdminController, PaymentsCustomerController, StripeWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
