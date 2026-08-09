import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { QueryPaymentDto } from './dto/query-payment.dto';

@Controller('admin/payments')
@Roles(user_role.admin, user_role.manager)
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@Query() query: QueryPaymentDto) {
    return this.paymentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.paymentsService.findOne(id);
  }
}
