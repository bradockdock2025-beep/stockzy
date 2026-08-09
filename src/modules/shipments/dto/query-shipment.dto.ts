import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { shipment_status } from '@prisma/client';

export class QueryShipmentDto {
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
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsEnum(shipment_status)
  status?: shipment_status;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;
}
