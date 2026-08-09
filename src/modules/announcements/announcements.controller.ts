import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AnnouncementsService } from './announcements.service';
import { QueryAnnouncementDto } from './dto/query-announcement.dto';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Public()
  @Get()
  findActive(@Query() query: QueryAnnouncementDto) {
    return this.announcementsService.findActive(query.locale);
  }
}
