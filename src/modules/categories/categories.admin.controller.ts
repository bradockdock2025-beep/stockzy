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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { MergeCategoryDto } from './dto/merge-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('admin/categories')
@Roles(user_role.admin, user_role.manager)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryCategoryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.categoriesService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.categoriesService.remove(id, buildAuditContext(req));
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.categoriesService.remove(id, buildAuditContext(req));
  }

  @Post(':id/merge')
  merge(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MergeCategoryDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.categoriesService.mergeInto(
      id,
      dto.targetCategoryId,
      buildAuditContext(req),
    );
  }
}
