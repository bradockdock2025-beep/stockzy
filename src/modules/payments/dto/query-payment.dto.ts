import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { payment_status } from '@prisma/client';

export class QueryPaymentDto {
  @IsOptional()
  @IsEnum(payment_status)
  status?: payment_status;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
