import { Module } from '@nestjs/common';
import { RecommendationsController, CatalogRecentlyViewedController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsCron } from './recommendations.cron';
import { PrismaService } from '../../database/prisma.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [RecommendationsController, CatalogRecentlyViewedController],
  providers: [RecommendationsService, RecommendationsCron, PrismaService],
})
export class RecommendationsModule {}
