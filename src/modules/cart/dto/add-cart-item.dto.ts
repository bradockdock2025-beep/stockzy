import { IsInt, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
