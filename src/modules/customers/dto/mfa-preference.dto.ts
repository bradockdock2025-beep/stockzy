import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class MfaPreferenceDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['sms', 'email', 'totp'])
  method?: 'sms' | 'email' | 'totp';
}
