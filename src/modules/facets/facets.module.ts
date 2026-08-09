import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../../common/redis/redis.module';
import { FacetsAdminController } from './facets.admin.controller';
import { FacetsService } from './facets.service';

@Module({
  imports: [DatabaseModule, AuditModule, RedisModule],
  controllers: [FacetsAdminController],
  providers: [FacetsService],
})
export class FacetsModule {}
