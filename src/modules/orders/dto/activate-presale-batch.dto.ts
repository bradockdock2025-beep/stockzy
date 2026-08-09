import { IsUUID } from 'class-validator';

export class ActivatePresaleBatchDto {
  @IsUUID()
  variantId: string;
}
