import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateHeroDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  desktopImage?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  mobileImage?: string;

  @IsOptional()
  @IsString()
  eyebrow?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
