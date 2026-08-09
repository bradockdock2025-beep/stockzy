import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { QuerySectionDto } from './dto/query-section.dto';
import { ProductsService } from './products.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  async findAll(@Query() query: QueryProductDto) {
    const result = await this.productsService.findAll(query);
    return {
      ...result,
      data: (result.data as any[]).map((product) => this.productsService.toListItem(product)),
    };
  }

  @Public()
  @Get('offers')
  findOffers(@Query() query: QueryOffersDto) {
    return this.productsService.findOffers(query);
  }

  @Public()
  @Get('highlights')
  findHighlights(@Query() query: QuerySectionDto) {
    return this.productsService.findHighlights(query);
  }

  @Public()
  @Get('new-arrivals')
  findNewArrivals(@Query() query: QuerySectionDto) {
    return this.productsService.findNewArrivals(query);
  }

  @Public()
  @Get('best-sellers')
  findBestSellers(@Query() query: QuerySectionDto) {
    return this.productsService.findBestSellers(query);
  }

  @Public()
  @Get('best-prices')
  findBestPrices(@Query() query: QuerySectionDto) {
    return this.productsService.findBestPrices(query);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryProductDto,
  ) {
    return this.productsService.findOne(id, query);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string, @Query() query: QueryProductDto) {
    return this.productsService.findBySlug(slug, query);
  }
}
