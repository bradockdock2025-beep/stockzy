import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [SearchController],
  providers: [SearchService, PrismaService],
})
export class SearchModule {}
