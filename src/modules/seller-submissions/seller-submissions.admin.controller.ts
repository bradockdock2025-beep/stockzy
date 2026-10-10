import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { SellerSubmissionsService } from './seller-submissions.service';
import { QuerySellerSubmissionDto } from './dto/query-seller-submission.dto';
import { ApproveSellerSubmissionDto } from './dto/approve-seller-submission.dto';
import { RejectSellerSubmissionDto } from './dto/reject-seller-submission.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/seller-submissions')
@Roles(user_role.admin, user_role.manager)
export class SellerSubmissionsAdminController {
  constructor(private readonly sellerSubmissionsService: SellerSubmissionsService) {}

  @Get()
  findAll(@Query() query: QuerySellerSubmissionDto) {
    return this.sellerSubmissionsService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellerSubmissionsService.findOneForAdmin(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveSellerSubmissionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.approve(id, dto, buildAuditContext(req));
  }

  @Patch(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectSellerSubmissionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.sellerSubmissionsService.reject(id, dto, buildAuditContext(req));
  }
}
