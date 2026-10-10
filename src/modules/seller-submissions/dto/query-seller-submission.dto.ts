import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { seller_submission_status } from '@prisma/client';

export class QuerySellerSubmissionDto {
  @IsOptional()
  @IsEnum(seller_submission_status)
  status?: seller_submission_status;

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
}
