import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class QueryBannerDto {
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
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsString()
  context?: string;
}
