import { IsEnum, IsOptional, IsString } from 'class-validator';
import { address_type } from '@prisma/client';

export class UpdateAddressDto {
  @IsOptional()
  @IsEnum(address_type)
  type?: address_type;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipcode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
