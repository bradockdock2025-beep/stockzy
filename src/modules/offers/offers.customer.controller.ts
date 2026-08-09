import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CustomerAuthGuard } from '../customers/customer-auth.guard';
import { OffersService } from './offers.service';
import { CreateCustomerOfferDto } from './dto/create-customer-offer.dto';

@Public()
@Controller('customers/offers')
@UseGuards(CustomerAuthGuard)
export class OffersCustomerController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  create(
    @Req() req: { customerAuth?: { authUserId?: string } },
    @Body() dto: CreateCustomerOfferDto,
  ) {
    return this.offersService.createCustomerOffer(req.customerAuth?.authUserId ?? '', dto);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { customerAuth?: { authUserId?: string } },
  ) {
    return this.offersService.findForCustomer(id, req.customerAuth?.authUserId ?? '');
  }
}
