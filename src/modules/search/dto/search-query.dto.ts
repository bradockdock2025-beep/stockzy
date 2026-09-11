import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // Antes travado em 48 — forçava o frontend a paginar 4-5x só pra montar um
  // índice id→slug de uma categoria inteira (uso SSR/servidor→servidor). Subi
  // pra 200, mesmo teto informal já usado em GET /products?limit=200.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsIn(['relevance', 'newest', 'price_asc', 'price_desc', 'discount'])
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'discount';

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
  @IsBooleanString()
  inStock?: string;

  @IsOptional()
  @IsBooleanString()
  hasDiscount?: string;

  // Brand.slug, um ou vários
  @IsOptional()
  @IsString({ each: true })
  brand?: string | string[];

  // Genérico, referencia Facet.key — "key:val1|val2;key2:val3" (mesmo formato de QueryProductDto)
  @IsOptional()
  @IsString()
  facets?: string;
}
