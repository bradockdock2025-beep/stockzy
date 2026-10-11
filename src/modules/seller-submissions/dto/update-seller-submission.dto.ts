import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Min,
} from 'class-validator';
import { seller_item_condition } from '@prisma/client';

/**
 * PATCH JSON (não multipart — imagens têm endpoints próprios). Tudo opcional: o admin
 * corrige só o que precisa, inclusive os dados do vendedor (nome/e-mail/telefone), que
 * pode ter vindo errado no formulário.
 */
export class UpdateSellerSubmissionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sellerName?: string;

  @IsOptional()
  @IsEmail()
  sellerEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sellerPhone?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  modelName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  size?: string;

  @IsOptional()
  @IsEnum(seller_item_condition)
  condition?: seller_item_condition;

  @IsOptional()
  @IsBoolean()
  originalBox?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  askingPrice?: number;

  @IsOptional()
  @IsString()
  additionalDetails?: string;

  @IsOptional()
  @IsUrl()
  spreadsheetLink?: string;
}
