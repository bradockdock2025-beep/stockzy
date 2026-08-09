import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { order_status } from '@prisma/client';

export class CreateOrderItemDto {
  @IsUUID()
  variantId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  unitPrice: number;

  @Type(() => Number)
  @IsNumber()
  totalPrice: number;
}

export class CreateOrderDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsOptional()
  @IsEnum(order_status)
  status?: order_status;

  @Type(() => Number)
  @IsNumber()
  subtotal: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountAmount?: number;

  @Type(() => Number)
  @IsNumber()
  totalAmount: number;

  @IsObject()
  shippingAddress: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
