import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { HomepageController } from './homepage.controller';
import { HomepageAdminController } from './homepage.admin.controller';
import { HomepageService } from './homepage.service';

@Module({
  imports: [DatabaseModule, ConfigModule, AuditModule],
  controllers: [HomepageController, HomepageAdminController],
  providers: [HomepageService],
})
export class HomepageModule {}
