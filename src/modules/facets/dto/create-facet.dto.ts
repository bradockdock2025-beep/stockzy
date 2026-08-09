import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { facet_input_type, facet_scope, facet_visibility } from '@prisma/client';

export class CreateFacetDto {
  // Identificador estável usado nas queries (facets=key:val1|val2) — sem espaços/acentos
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must be lowercase snake_case (ex.: activity, size_men)',
  })
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(facet_input_type)
  inputType: facet_input_type;

  @IsOptional()
  @IsEnum(facet_scope)
  scope?: facet_scope;

  @IsOptional()
  @IsEnum(facet_visibility)
  visibility?: facet_visibility;

  // Obrigatório quando visibility = category_family (tag da Category) ou gender_equals (ex.: "kids")
  @IsOptional()
  @IsString()
  visibilityValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
