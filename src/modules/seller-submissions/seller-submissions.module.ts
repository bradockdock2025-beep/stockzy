import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { SellerSubmissionsController } from './seller-submissions.controller';
import { SellerSubmissionsAdminController } from './seller-submissions.admin.controller';
import { SellerSubmissionsService } from './seller-submissions.service';

@Module({
  imports: [DatabaseModule, NotificationsModule, AuditModule],
  controllers: [SellerSubmissionsController, SellerSubmissionsAdminController],
  providers: [SellerSubmissionsService],
})
export class SellerSubmissionsModule {}
