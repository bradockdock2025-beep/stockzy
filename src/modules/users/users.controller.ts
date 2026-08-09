import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

@Controller('admin/users')
@Roles(user_role.admin, user_role.manager)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.usersService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.usersService.remove(id, buildAuditContext(req));
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.usersService.remove(id, buildAuditContext(req));
  }
}
