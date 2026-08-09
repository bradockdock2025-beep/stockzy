import { Controller, Get, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PromotionsService } from './promotions.service';

class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

@Public()
@Controller('coupons')
export class PromotionsPublicController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('validate')
  validate(@Query() query: ValidateCouponDto) {
    return this.promotionsService.validateCode(query.code);
  }
}
