import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { facet_scope } from '@prisma/client';

export class QueryFacetDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsEnum(facet_scope)
  scope?: facet_scope;
}
