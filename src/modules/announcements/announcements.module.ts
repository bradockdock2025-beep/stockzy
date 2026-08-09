import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AnnouncementsAdminController } from './announcements.admin.controller';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AnnouncementsController, AnnouncementsAdminController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
