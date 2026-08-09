import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { product_status } from '@prisma/client';

class CreateVariantDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsOptional()
  compareAtPrice?: number;

  @IsNumber()
  stockQuantity: number;

  // Facetas scope=variant (ex.: color, size_men)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  facetValueIds?: string[];
}


export class CreateProductDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(product_status)
  status?: product_status;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  // Facetas scope=product (ex.: gender, activity)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  facetValueIds?: string[];
}
