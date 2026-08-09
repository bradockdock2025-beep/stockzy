import { IsIn, IsString } from 'class-validator';

export class VerifyEmailLinkDto {
  @IsString()
  tokenHash: string;

  @IsString()
  @IsIn(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])
  type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
}
