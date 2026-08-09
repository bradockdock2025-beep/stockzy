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
import { FacetsService } from './facets.service';
import { CreateFacetDto } from './dto/create-facet.dto';
import { UpdateFacetDto } from './dto/update-facet.dto';
import { QueryFacetDto } from './dto/query-facet.dto';
import { CreateFacetValueDto } from './dto/create-facet-value.dto';
import { UpdateFacetValueDto } from './dto/update-facet-value.dto';

@Controller('admin/facets')
@Roles(user_role.admin, user_role.manager)
export class FacetsAdminController {
  constructor(private readonly facetsService: FacetsService) {}

  @Post()
  create(
    @Body() dto: CreateFacetDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryFacetDto) {
    return this.facetsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.facetsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFacetDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.update(id, dto, buildAuditContext(req));
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.remove(id, buildAuditContext(req));
  }

  // ─── FacetValue ─────────────────────────────────────────────────────────

  @Post(':facetId/values')
  createValue(
    @Param('facetId', new ParseUUIDPipe()) facetId: string,
    @Body() dto: CreateFacetValueDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.createValue(facetId, dto, buildAuditContext(req));
  }

  @Patch(':facetId/values/:id')
  updateValue(
    @Param('facetId', new ParseUUIDPipe()) facetId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFacetValueDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.updateValue(facetId, id, dto, buildAuditContext(req));
  }

  @Delete(':facetId/values/:id')
  removeValue(
    @Param('facetId', new ParseUUIDPipe()) facetId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.facetsService.removeValue(facetId, id, buildAuditContext(req));
  }
}
