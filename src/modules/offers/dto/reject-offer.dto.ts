import { IsIn, IsOptional } from 'class-validator';

export class RejectOfferDto {
  @IsOptional()
  @IsIn(['below_minimum', 'sold_out', 'other'])
  reason?: 'below_minimum' | 'sold_out' | 'other';
}
