import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { RedisModule } from '../../common/redis/redis.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ExecutiveDashboardService } from './executive-dashboard.service';

@Module({
  imports: [DatabaseModule, OrdersModule, RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService, ExecutiveDashboardService],
})
export class DashboardModule {}
