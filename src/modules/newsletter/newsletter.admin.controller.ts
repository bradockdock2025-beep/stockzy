import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { NewsletterService } from './newsletter.service';

@Roles(user_role.admin, user_role.manager)
@Controller('admin/newsletter')
export class NewsletterAdminController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('subscriptions/export')
  exportAll(@Query('activeOnly') activeOnly?: string) {
    return this.newsletterService.exportAll(activeOnly !== 'false');
  }

  @Get('subscriptions')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.newsletterService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      activeOnly !== 'false',
    );
  }

  @Delete('subscriptions/:id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.newsletterService.remove(id, buildAuditContext(req));
  }
}
