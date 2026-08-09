import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  textPt: string;

  @IsOptional()
  @IsString()
  textFr?: string;

  @IsOptional()
  @IsString()
  textEn?: string;

  @IsOptional()
  @IsString()
  textEs?: string;

  @IsOptional()
  @IsUrl()
  link?: string;

  @IsOptional()
  @IsString()
  linkTextPt?: string;

  @IsOptional()
  @IsString()
  linkTextFr?: string;

  @IsOptional()
  @IsString()
  linkTextEn?: string;

  @IsOptional()
  @IsString()
  linkTextEs?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
