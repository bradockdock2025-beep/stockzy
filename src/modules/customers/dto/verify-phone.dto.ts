import { IsString } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  token: string;
}
