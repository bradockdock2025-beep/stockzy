import { Controller, Get, Query } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryLoginRateLimitAuditDto } from './dto/query-login-rate-limit-audit.dto';
import { LoginRateLimitAuditService } from './login-rate-limit-audit.service';

@Controller('admin/login-rate-limit-audits')
@Roles(user_role.admin, user_role.manager)
export class LoginRateLimitAuditController {
  constructor(private readonly auditService: LoginRateLimitAuditService) {}

  @Get()
  list(@Query() query: QueryLoginRateLimitAuditDto) {
    return this.auditService.list(query);
  }
}
