import { IsIn, IsOptional, IsString } from 'class-validator';

export class RequestPhoneVerificationDto {
  @IsOptional()
  @IsString()
  @IsIn(['sms', 'whatsapp'])
  channel?: 'sms' | 'whatsapp';
}
