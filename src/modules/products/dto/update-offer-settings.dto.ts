import { IsBoolean } from 'class-validator';

export class UpdateOfferSettingsDto {
  @IsBoolean()
  offerEnabled: boolean;
}
