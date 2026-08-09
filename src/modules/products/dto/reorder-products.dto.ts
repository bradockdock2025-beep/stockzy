import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProductPositionDto {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(1)
  position: number;
}

export class ReorderProductsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPositionDto)
  products: ProductPositionDto[];
}
