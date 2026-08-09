import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { OrdersService } from './orders.service';
import { QueryOrderDto } from './dto/query-order.dto';

@Controller('admin/reports')
@Public()
@UseGuards(AdminApiKeyGuard)
export class OrdersReportsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  orders(@Query() query: QueryOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Get('orders/:id')
  order(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.findOne(id);
  }

  @Get('sales')
  sales() {
    return this.ordersService.getSalesSummary();
  }
}
