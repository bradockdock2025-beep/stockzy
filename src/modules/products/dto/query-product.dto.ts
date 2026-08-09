import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { product_status } from '@prisma/client';

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(product_status)
  status?: product_status;

  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['featured', 'price_asc', 'price_desc', 'newest', 'relevance'])
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'relevance';

  @IsOptional()
  @IsBooleanString()
  inStock?: string;

  // Preço da variante < compareAtPrice ("Below Retail")
  @IsOptional()
  @IsBooleanString()
  belowRetail?: string;

  // Brand.slug, um ou vários
  @IsOptional()
  @IsString({ each: true })
  brand?: string | string[];

  // Genérico, referencia Facet.key — "key:val1|val2;key2:val3" (ex.: "activity:running|basketball;color:black")
  @IsOptional()
  @IsString()
  facets?: string;
}
