import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { order_status } from '@prisma/client';
import { CreateOrderItemDto } from './create-order.dto';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsEnum(order_status)
  status?: order_status;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
