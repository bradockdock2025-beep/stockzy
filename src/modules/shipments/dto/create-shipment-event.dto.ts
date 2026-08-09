import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { shipment_status } from '@prisma/client';

export class CreateShipmentEventDto {
  @IsEnum(shipment_status)
  status: shipment_status;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  metadata?: Record<string, unknown>;
}
