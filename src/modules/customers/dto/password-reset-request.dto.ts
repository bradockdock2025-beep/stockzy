import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['pt', 'fr', 'en', 'es'])
  locale?: 'pt' | 'fr' | 'en' | 'es';
}
