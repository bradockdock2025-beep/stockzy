import { Module } from '@nestjs/common';
import { RecommendationsController, CatalogRecentlyViewedController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsCron } from './recommendations.cron';
import { PrismaService } from '../../database/prisma.service';
import { RedisModule } from '../../common/redis/redis.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [RedisModule, CustomersModule],
  controllers: [RecommendationsController, CatalogRecentlyViewedController],
  providers: [RecommendationsService, RecommendationsCron, PrismaService],
})
export class RecommendationsModule {}
