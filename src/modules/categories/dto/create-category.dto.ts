import { IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  // Tag usada pela regra de visibilidade "category_family" de Facet (ex.: "calcado")
  @IsOptional()
  @IsString()
  familyTag?: string;

  // Banner de /category/{slug} (buildingConcept/PAGE-BROWSE-MEN.md §2) — fallback pro name se não setado
  @IsOptional()
  @IsString()
  bannerTitle?: string;

  @IsOptional()
  @IsString()
  bannerDescription?: string;
}
