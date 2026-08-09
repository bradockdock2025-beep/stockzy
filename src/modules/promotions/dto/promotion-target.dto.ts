import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class PromotionTargetDto {
  @IsIn(['cart', 'product', 'category'])
  type: 'cart' | 'product' | 'category';

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
