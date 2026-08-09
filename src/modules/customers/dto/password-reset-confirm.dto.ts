import { IsString, Matches, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'A password deve ter pelo menos uma maiúscula, uma minúscula e um número',
  })
  newPassword: string;
}
