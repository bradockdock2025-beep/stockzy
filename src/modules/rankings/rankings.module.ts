import { Module } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [RankingsService, PrismaService],
  exports: [RankingsService],
})
export class RankingsModule {}
