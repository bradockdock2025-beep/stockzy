import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateGuestOfferDto {
  @IsNumber()
  @Min(0.01)
  offeredPrice: number;

  @IsEmail()
  @IsNotEmpty()
  guestEmail: string;

  @IsOptional()
  @IsIn(['pt', 'fr', 'en', 'es'])
  locale?: 'pt' | 'fr' | 'en' | 'es';
}
