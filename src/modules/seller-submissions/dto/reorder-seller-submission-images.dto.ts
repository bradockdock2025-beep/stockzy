import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ImagePositionDto {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderSellerSubmissionImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImagePositionDto)
  images: ImagePositionDto[];
}
