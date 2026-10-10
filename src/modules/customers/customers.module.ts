import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { CustomersController } from './customers.controller';
import { CustomersAdminController } from './customers.admin.controller';
import { CustomersWebhookController } from './customers.webhook.controller';
import { CustomersService } from './customers.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { CustomerAuthResolverService } from './customer-auth-resolver.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { OptionalCustomerAuthGuard } from './optional-customer-auth.guard';
import { CustomerRateLimitGuard } from './customer-rate-limit.guard';

@Module({
  imports: [DatabaseModule, AuthModule, RedisModule, NotificationsModule, AuditModule],
  controllers: [CustomersController, CustomersAdminController, CustomersWebhookController],
  providers: [
    CustomersService,
    SupabaseAuthService,
    CustomerAuthResolverService,
    CustomerAuthGuard,
    OptionalCustomerAuthGuard,
    CustomerRateLimitGuard,
  ],
  exports: [
    CustomerAuthGuard,
    OptionalCustomerAuthGuard,
    CustomerAuthResolverService,
    SupabaseAuthService,
    RedisModule,
  ],
})
export class CustomersModule {}
