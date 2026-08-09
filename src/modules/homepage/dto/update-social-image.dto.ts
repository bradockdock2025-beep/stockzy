import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSocialImageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageSrc?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  alt?: string;

  @IsOptional()
  @IsString()
  href?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
