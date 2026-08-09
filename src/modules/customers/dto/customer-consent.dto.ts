import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CustomerConsentDto {
  @IsString()
  @IsIn(['terms', 'privacy', 'marketing'])
  type: 'terms' | 'privacy' | 'marketing';

  @IsBoolean()
  granted: boolean;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
