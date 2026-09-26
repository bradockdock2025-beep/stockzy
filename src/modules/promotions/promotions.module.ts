import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { PromotionsAdminController } from './promotions.admin.controller';
import { PromotionsPublicController } from './promotions.public.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PromotionsAdminController, PromotionsPublicController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
