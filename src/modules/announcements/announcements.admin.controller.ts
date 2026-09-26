import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { QueryAnnouncementDto } from './dto/query-announcement.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/announcements')
@Roles(user_role.admin, user_role.manager)
export class AnnouncementsAdminController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @Req() req: ReqWithAuth) {
    return this.announcementsService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryAnnouncementDto) {
    return this.announcementsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.announcementsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.announcementsService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.announcementsService.deactivate(id, buildAuditContext(req));
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.announcementsService.remove(id, buildAuditContext(req));
  }
}
