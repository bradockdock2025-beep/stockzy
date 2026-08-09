import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class QueryAnnouncementDto {
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
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsIn(['pt', 'fr', 'en', 'es'])
  locale?: 'pt' | 'fr' | 'en' | 'es';
}
