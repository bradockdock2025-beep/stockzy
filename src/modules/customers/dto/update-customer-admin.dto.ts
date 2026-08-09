import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
