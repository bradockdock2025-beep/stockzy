import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { user_role } from '@prisma/client';
import { buildAuditContext } from '../../common/audit/audit-context';
import { OffersService } from './offers.service';
import { QueryAdminOffersDto } from './dto/query-admin-offers.dto';
import { RejectOfferDto } from './dto/reject-offer.dto';

type ReqWithAuth = { user?: { sub?: string }; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/offers')
@Roles(user_role.admin, user_role.manager)
export class OffersAdminController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll(@Query() query: QueryAdminOffersDto) {
    return this.offersService.listForAdmin(query.status);
  }

  @Patch(':id/accept')
  accept(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.offersService.accept(id, req.user?.sub ?? null, buildAuditContext(req));
  }

  @Patch(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: ReqWithAuth,
    @Body() dto: RejectOfferDto,
  ) {
    return this.offersService.reject(id, req.user?.sub ?? null, dto, buildAuditContext(req));
  }
}
