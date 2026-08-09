import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateCustomerOfferDto {
  @IsUUID()
  variantId: string;

  @IsNumber()
  @Min(0.01)
  offeredPrice: number;

  @IsOptional()
  @IsIn(['pt', 'fr', 'en', 'es'])
  locale?: 'pt' | 'fr' | 'en' | 'es';
}
