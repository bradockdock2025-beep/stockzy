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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalCustomerAuthGuard } from '../customers/optional-customer-auth.guard';
import { CustomerAuthPayload } from '../customers/customer-auth-resolver.service';
import { RecommendationsService } from './recommendations.service';
import { AlsoViewedQueryDto } from './dto/also-viewed-query.dto';
import { RecordViewDto } from './dto/record-view.dto';
import { RecentlyViewedQueryDto } from './dto/recently-viewed-query.dto';
import { RecommendedQueryDto } from './dto/recommended-query.dto';

type RequestWithOptionalAuth = Request & { customerAuth?: CustomerAuthPayload };

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
  @UseGuards(OptionalCustomerAuthGuard)
  @Post(':id/view')
  @HttpCode(204)
  async recordView(
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() body: RecordViewDto,
    @Req() req: RequestWithOptionalAuth,
  ) {
    const customerId = await this.recommendationsService.resolveAuthenticatedCustomerId(
      req.customerAuth?.authUserId,
    );
    return this.recommendationsService.recordView(productId, body, req, customerId);
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
  @UseGuards(OptionalCustomerAuthGuard)
  @Get('recently-viewed')
  async getRecentlyViewed(
    @Query() query: RecentlyViewedQueryDto,
    @Req() req: RequestWithOptionalAuth,
  ) {
    const customerId = await this.recommendationsService.resolveAuthenticatedCustomerId(
      req.customerAuth?.authUserId,
    );
    return this.recommendationsService.getRecentlyViewed(
      query.sessionId,
      customerId,
      query.limit ?? 12,
    );
  }

  @Public()
  @UseGuards(OptionalCustomerAuthGuard)
  @Get('recommended')
  async getRecommended(
    @Query() query: RecommendedQueryDto,
    @Req() req: RequestWithOptionalAuth,
  ) {
    const customerId = await this.recommendationsService.resolveAuthenticatedCustomerId(
      req.customerAuth?.authUserId,
    );
    return this.recommendationsService.getRecommendedForYou(
      query.sessionId,
      customerId,
      query.limit ?? 12,
    );
  }
}
