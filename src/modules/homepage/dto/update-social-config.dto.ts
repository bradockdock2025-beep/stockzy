import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateSocialConfigDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  handle?: string;

  @IsOptional()
  @IsUrl()
  followHref?: string;
}
