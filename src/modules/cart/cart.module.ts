import { Module } from '@nestjs/common';
import { RedisModule } from '../../common/redis/redis.module';
import { DatabaseModule } from '../../database/database.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [RedisModule, DatabaseModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
