import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { shipment_status } from '@prisma/client';

export class CreateShipmentDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsEnum(shipment_status)
  status?: shipment_status;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  serviceLevel?: string;

  @IsOptional()
  @IsDateString()
  shippedAt?: string;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  metadata?: Record<string, unknown>;
}
