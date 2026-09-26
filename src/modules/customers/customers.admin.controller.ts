import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { CustomersService } from './customers.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerAdminDto } from './dto/update-customer-admin.dto';

type ReqWithAuth = { user?: unknown; headers?: Record<string, unknown>; ip?: string };

@Controller('admin/customers')
@Roles(user_role.admin, user_role.manager)
export class CustomersAdminController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(user_role.admin, user_role.manager, user_role.support)
  findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

  // Exports de dado bruto do cliente ficam de fora do acesso "support" de propósito —
  // é extração em massa/individual de PII, escopo diferente de "ver pedido/cliente pra
  // atender chamado" (ver PLANO_IMPLEMENTACAO_AJUSTES_BACKEND_GESTAO.md, P0.2).
  @Get('export')
  exportAll(@Query() query: QueryCustomerDto) {
    return this.customersService.exportAll(query);
  }

  @Get('full')
  findAllWithDetails(@Query() query: QueryCustomerDto) {
    return this.customersService.findAllWithDetails(query);
  }

  @Get(':id/export')
  exportOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.exportOne(id);
  }

  @Get(':id')
  @Roles(user_role.admin, user_role.manager, user_role.support)
  findOneWithDetails(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.findOneWithDetails(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerAdminDto,
    @Req() req: ReqWithAuth,
  ) {
    return this.customersService.updateAdmin(id, dto, buildAuditContext(req));
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: ReqWithAuth) {
    return this.customersService.deactivate(id, buildAuditContext(req));
  }
}
