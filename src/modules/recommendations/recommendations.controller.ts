import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RecommendationsService } from './recommendations.service';
import { AlsoViewedQueryDto } from './dto/also-viewed-query.dto';
import { RecordViewDto } from './dto/record-view.dto';
import { RecentlyViewedQueryDto } from './dto/recently-viewed-query.dto';
import { RecommendedQueryDto } from './dto/recommended-query.dto';

@Controller('products')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Public()
  @Get(':id/also-viewed')
  alsoViewed(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query() query: AlsoViewedQueryDto,
  ) {
    return this.recommendationsService.getAlsoViewed(productId, query);
  }

  @Public()
  @Post(':id/view')
  @HttpCode(204)
  recordView(
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() body: RecordViewDto,
    @Req() req: Request,
  ) {
    return this.recommendationsService.recordView(productId, body, req);
  }
}

/**
 * Rota separada em /catalog (não /products) de propósito: um `@Get('recently-viewed')`
 * dentro de @Controller('products') colidiria com ProductsController's @Get(':id')
 * (mesmo módulo registrado antes), já que Nest casa rotas por ordem de registro.
 */
@Controller('catalog')
export class CatalogRecentlyViewedController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Public()
  @Get('recently-viewed')
  getRecentlyViewed(@Query() query: RecentlyViewedQueryDto) {
    return this.recommendationsService.getRecentlyViewed(
      query.sessionId,
      query.customerId,
      query.limit ?? 12,
    );
  }

  @Public()
  @Get('recommended')
  getRecommended(@Query() query: RecommendedQueryDto) {
    return this.recommendationsService.getRecommendedForYou(
      query.sessionId,
      query.customerId,
      query.limit ?? 12,
    );
  }
}
