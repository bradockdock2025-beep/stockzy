import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { BannersAdminController } from './banners.admin.controller';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [BannersController, BannersAdminController],
  providers: [BannersService],
})
export class BannersModule {}
