import { IsEnum, IsOptional, IsString } from 'class-validator';
import { address_type } from '@prisma/client';

export class CreateAddressDto {
  @IsEnum(address_type)
  type: address_type;

  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipcode?: string;

  @IsString()
  country: string;
}
