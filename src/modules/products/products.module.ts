import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ProductsController } from './products.controller';
import { FiltersController } from './filters.controller';
import { ProductsService } from './products.service';
import { ProductsAdminController } from './products.admin.controller';

@Module({
  imports: [DatabaseModule, AuditModule, RedisModule],
  controllers: [
    ProductsController,
    ProductsAdminController,
    FiltersController,
  ],
  providers: [ProductsService],
})
export class ProductsModule {}
