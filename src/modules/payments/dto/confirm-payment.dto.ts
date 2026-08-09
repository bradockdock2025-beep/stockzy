import { IsString, Matches } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
