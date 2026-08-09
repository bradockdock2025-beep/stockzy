import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { user_role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { ActivatePresaleBatchDto } from './dto/activate-presale-batch.dto';

@Controller('admin/orders')
@Roles(user_role.admin, user_role.manager)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(dto, buildAuditContext(req));
  }

  @Get()
  findAll(@Query() query: QueryOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.ordersService.update(id, dto, buildAuditContext(req));
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.ordersService.updateStatus(id, dto.status, buildAuditContext(req));
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
  ) {
    return this.ordersService.remove(
      id,
      buildAuditContext(req),
      idempotencyKey ?? fallbackIdempotencyKey,
    );
  }

  @Post('presale/activate')
  activatePresaleBatch(
    @Body() dto: ActivatePresaleBatchDto,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.ordersService.activatePresaleBatch(dto.variantId, buildAuditContext(req));
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
  ) {
    return this.ordersService.remove(
      id,
      buildAuditContext(req),
      idempotencyKey ?? fallbackIdempotencyKey,
    );
  }
}
