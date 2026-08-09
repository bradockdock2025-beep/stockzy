import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { HomepageController } from './homepage.controller';
import { HomepageAdminController } from './homepage.admin.controller';
import { HomepageService } from './homepage.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [HomepageController, HomepageAdminController],
  providers: [HomepageService],
})
export class HomepageModule {}
