import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { OrdersService } from './orders.service';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { CreateGuestOrderFromOfferDto } from './dto/create-guest-order-from-offer.dto';

@Public()
@Controller('orders/guest')
export class OrdersGuestController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('quote')
  quote(
    @Headers('x-cart-token') cartToken: string | undefined,
    @Query('country') country: string,
  ) {
    if (!cartToken) {
      throw new BadRequestException('x-cart-token header is required');
    }
    if (!country) {
      throw new BadRequestException('country query param is required');
    }
    return this.ordersService.quoteGuestCart({ cartToken, country });
  }

  @Post()
  create(
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: CreateGuestOrderDto,
  ) {
    if (!cartToken) {
      throw new BadRequestException('x-cart-token header is required');
    }
    return this.ordersService.createGuestOrder({
      cartToken,
      phone: dto.phone,
      country: dto.country,
      locale: dto.locale,
    });
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    if (!token) {
      throw new BadRequestException('token query param is required');
    }
    return this.ordersService.findGuestOrder(id, token);
  }

  @Post('from-offer')
  createFromOffer(
    @Headers('x-offer-token') offerToken: string | undefined,
    @Body() dto: CreateGuestOrderFromOfferDto,
  ) {
    if (!offerToken) {
      throw new BadRequestException('x-offer-token header is required');
    }
    return this.ordersService.createGuestOrderFromOffer({
      offerId: dto.offerId,
      guestToken: offerToken,
      phone: dto.phone,
      country: dto.country,
      locale: dto.locale,
    });
  }
}
