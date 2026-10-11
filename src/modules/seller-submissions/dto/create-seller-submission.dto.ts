import { Type } from 'class-transformer';
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
 * multipart/form-data — os campos chegam como string do form, `transform: true` no
 * ValidationPipe global + `@Type()` aqui fazem a coerção (mesmo padrão exigido por
 * qualquer DTO que acompanha upload de ficheiro nesta app).
 */
export class CreateSellerSubmissionDto {
  @IsString()
  @IsNotEmpty()
  sellerName: string;

  @IsEmail()
  sellerEmail: string;

  @IsString()
  @IsNotEmpty()
  sellerPhone: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsEnum(seller_item_condition)
  condition: seller_item_condition;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  originalBox?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  askingPrice: number;

  @IsOptional()
  @IsString()
  additionalDetails?: string;

  @IsOptional()
  @IsUrl()
  spreadsheetLink?: string;

  /**
   * Checkbox obrigatório — "confirmo que sou o proprietário legítimo deste item e que a
   * descrição é precisa". Só `true` passa; `create()` recusa qualquer outro valor. Não
   * existe estado "recusado" — quem não aceita, simplesmente não consegue submeter.
   */
  @Type(() => Boolean)
  @IsBoolean()
  termsAccepted: boolean;
}
