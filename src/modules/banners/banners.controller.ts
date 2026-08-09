import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { BannersService } from './banners.service';
import { QueryBannerDto } from './dto/query-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  findActive(@Query() query: QueryBannerDto) {
    return this.bannersService.findActive(query.context);
  }
}
