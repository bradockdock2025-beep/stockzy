import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { QueryOrderDto } from './dto/query-order.dto';
import { CustomerAuthGuard } from '../customers/customer-auth.guard';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { CreateCustomerOrderFromOfferDto } from './dto/create-customer-order-from-offer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { buildAuditContext } from '../../common/audit/audit-context';

@Public()
@Controller('customers/orders')
@UseGuards(CustomerAuthGuard)
export class OrdersCustomerController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Req() req: { customerAuth?: { authUserId?: string }; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('x-cart-token') cartToken: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
    @Body() dto: CreateCustomerOrderDto,
  ) {
    return this.ordersService.createFromCustomerCart({
      authUserId: req.customerAuth?.authUserId ?? '',
      cartToken,
      idempotencyKey: idempotencyKey ?? fallbackIdempotencyKey,
      dto,
      context: buildAuditContext(req),
    });
  }

  @Post('from-offer')
  createFromOffer(
    @Req() req: { customerAuth?: { authUserId?: string }; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: CreateCustomerOrderFromOfferDto,
  ) {
    return this.ordersService.createOrderFromOfferForCustomer({
      authUserId: req.customerAuth?.authUserId ?? '',
      dto,
      context: buildAuditContext(req),
    });
  }

  @Post('quote')
  quote(
    @Req() req: { customerAuth?: { authUserId?: string } },
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: CreateCustomerOrderDto,
  ) {
    return this.ordersService.quoteFromCustomerCart({
      authUserId: req.customerAuth?.authUserId ?? '',
      cartToken,
      dto,
    });
  }

  @Get()
  findAll(
    @Req() req: { customerAuth?: { authUserId?: string } },
    @Query() query: QueryOrderDto,
  ) {
    return this.ordersService.findAllForCustomer(req.customerAuth?.authUserId ?? '', query);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { customerAuth?: { authUserId?: string } },
  ) {
    return this.ordersService.findOneForCustomer(id, req.customerAuth?.authUserId ?? '');
  }

  @Get(':id/tracking')
  tracking(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { customerAuth?: { authUserId?: string } },
  ) {
    return this.ordersService.findTrackingForCustomer(id, req.customerAuth?.authUserId ?? '');
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { customerAuth?: { authUserId?: string }; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
  ) {
    return this.ordersService.cancelForCustomer(
      id,
      req.customerAuth?.authUserId ?? '',
      buildAuditContext(req),
      idempotencyKey ?? fallbackIdempotencyKey,
    );
  }
}
