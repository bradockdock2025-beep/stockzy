import { IsOptional, IsString } from 'class-validator';

export class RequestEmailVerificationDto {
  @IsOptional()
  @IsString()
  redirectTo?: string;
}
