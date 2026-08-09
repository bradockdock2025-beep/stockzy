import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ChangeCustomerEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  redirectTo?: string;
}
