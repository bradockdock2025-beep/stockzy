import { Controller, Get, Query } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLogService } from './audit-log.service';

@Controller('admin/audit-logs')
@Roles(user_role.admin, user_role.manager)
export class AuditLogController {
  constructor(private readonly auditService: AuditLogService) {}

  @Get()
  list(@Query() query: QueryAuditLogDto) {
    return this.auditService.list(query);
  }
}
