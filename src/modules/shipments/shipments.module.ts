import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShipmentsAdminController } from './shipments.admin.controller';
import { ShipmentsService } from './shipments.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [ShipmentsAdminController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
