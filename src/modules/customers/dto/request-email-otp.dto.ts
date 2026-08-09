import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestEmailOtpDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  redirectTo?: string;
}
