import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomersService } from './customers.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerAdminDto } from './dto/update-customer-admin.dto';

@Controller('admin/customers')
@Roles(user_role.admin, user_role.manager)
export class CustomersAdminController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

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
  findOneWithDetails(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.findOneWithDetails(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerAdminDto,
  ) {
    return this.customersService.updateAdmin(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.deactivate(id);
  }
}
