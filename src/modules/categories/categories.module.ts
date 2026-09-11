import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './categories.admin.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [DatabaseModule, AuditModule, ConfigModule, RedisModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
