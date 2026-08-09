import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCustomerOrderFromOfferDto {
  @IsUUID()
  offerId: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['cod', 'stripe'])
  paymentMethod?: 'cod' | 'stripe';

  @IsOptional()
  @IsIn(['pt', 'fr', 'en', 'es'])
  locale?: 'pt' | 'fr' | 'en' | 'es';
}
