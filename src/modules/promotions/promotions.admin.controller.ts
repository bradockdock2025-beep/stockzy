import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/promotions')
@Roles(user_role.admin)
export class PromotionsAdminController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionDto, @Req() req: ReqWithAuth) {
    return this.promotionsService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryPromotionDto) {
    return this.promotionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.promotionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePromotionDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.promotionsService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.promotionsService.deactivate(id, buildAuditContext(req));
  }
}
