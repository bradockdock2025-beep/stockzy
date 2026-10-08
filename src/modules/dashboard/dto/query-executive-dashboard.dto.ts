import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class QueryExecutiveDashboardDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be a date in YYYY-MM-DD format' })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be a date in YYYY-MM-DD format' })
  to: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsString()
  tz?: string;
}
