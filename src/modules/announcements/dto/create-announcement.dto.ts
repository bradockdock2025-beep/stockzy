import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { IsUrlOrInternalPath } from '../../../common/validators/is-url-or-internal-path.validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
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
  @IsUrlOrInternalPath()
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
