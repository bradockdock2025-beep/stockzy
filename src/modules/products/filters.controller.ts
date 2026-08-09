import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { QuerySectionDto } from './dto/query-section.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('catalog')
export class FiltersController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('filters')
  getFilters(@Query() query: QueryProductDto) {
    return this.productsService.getFilters(query);
  }

  @Public()
  @Get('banner')
  getBanner(@Query() query: QueryProductDto) {
    return this.productsService.getBanner(query);
  }

  @Public()
  @Get('release-calendar')
  getReleaseCalendar(@Query() query: QuerySectionDto) {
    return this.productsService.getReleaseCalendar(query);
  }
}
