import { PartialType } from '@nestjs/mapped-types';
import { CreateFacetValueDto } from './create-facet-value.dto';

export class UpdateFacetValueDto extends PartialType(CreateFacetValueDto) {}
