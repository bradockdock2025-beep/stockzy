import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { user_role } from '@prisma/client';
import { OffersService } from './offers.service';
import { QueryAdminOffersDto } from './dto/query-admin-offers.dto';
import { RejectOfferDto } from './dto/reject-offer.dto';

@Controller('admin/offers')
@Roles(user_role.admin, user_role.manager)
export class OffersAdminController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll(@Query() query: QueryAdminOffersDto) {
    return this.offersService.listForAdmin(query.status);
  }

  @Patch(':id/accept')
  accept(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.offersService.accept(id, req.user?.sub ?? null);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { sub?: string } },
    @Body() dto: RejectOfferDto,
  ) {
    return this.offersService.reject(id, req.user?.sub ?? null, dto);
  }
}
