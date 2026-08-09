import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { OffersService } from './offers.service';
import { CreateGuestOfferDto } from './dto/create-guest-offer.dto';

@Public()
@Controller('products')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post(':variantId/offers')
  create(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: CreateGuestOfferDto,
  ) {
    return this.offersService.createGuestOffer(variantId, dto);
  }
}

@Public()
@Controller('orders/offers')
export class OffersGuestStatusController {
  constructor(private readonly offersService: OffersService) {}

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    return this.offersService.findForGuest(id, token);
  }
}
