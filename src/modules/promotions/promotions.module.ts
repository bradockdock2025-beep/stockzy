import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PromotionsAdminController } from './promotions.admin.controller';
import { PromotionsPublicController } from './promotions.public.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PromotionsAdminController, PromotionsPublicController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
