import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterCustomerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'A password deve ter pelo menos uma maiúscula, uma minúscula e um número',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
