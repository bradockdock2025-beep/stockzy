import { IsString, IsNotEmpty, IsUUID, Length, IsOptional, Matches } from 'class-validator';

export class CreateGuestOrderFromOfferDto {
  @IsUUID()
  offerId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be a valid international number' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  country: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
