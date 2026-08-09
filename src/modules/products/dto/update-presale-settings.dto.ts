import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdatePresaleSettingsDto {
  @IsBoolean()
  presaleEnabled: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  presalePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  presaleLimit?: number;

  @IsOptional()
  @IsDateString()
  expectedAvailableAt?: string;
}
