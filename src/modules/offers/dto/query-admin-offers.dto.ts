import { IsIn, IsOptional } from 'class-validator';
import { offer_status } from '@prisma/client';

export class QueryAdminOffersDto {
  @IsOptional()
  @IsIn(Object.values(offer_status))
  status?: offer_status;
}
