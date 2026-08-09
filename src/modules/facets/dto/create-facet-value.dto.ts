import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFacetValueDto {
  // Chave estável do valor (ex.: "black", "8", "running") — usada nas queries
  @IsString()
  @IsNotEmpty()
  value: string;

  // Texto exibido (ex.: "Black", "US M 8")
  @IsString()
  @IsNotEmpty()
  label: string;

  // Livre — ex.: { hex: "#000000" } pra swatch de cor, { gradient: true } pra "Multi"
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Banner de /browse/{gender} quando este valor pertence à faceta "gender" — fallback pro label se não setado
  @IsOptional()
  @IsString()
  bannerTitle?: string;

  @IsOptional()
  @IsString()
  bannerDescription?: string;
}
