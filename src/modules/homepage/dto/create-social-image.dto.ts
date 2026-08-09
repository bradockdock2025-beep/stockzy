import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSocialImageDto {
  @IsString()
  @IsNotEmpty()
  imageSrc: string;

  @IsString()
  @IsNotEmpty()
  alt: string;

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
