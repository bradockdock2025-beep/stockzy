import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../../common/redis/redis.module';
import { BrandsAdminController } from './brands.admin.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [DatabaseModule, AuditModule, RedisModule],
  controllers: [BrandsAdminController],
  providers: [BrandsService],
})
export class BrandsModule {}
