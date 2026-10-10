import { IsOptional, IsUUID } from 'class-validator';

/** `categoryId` opcional — só quando o admin quer corrigir a categoria que o vendedor escolheu. */
export class ApproveSellerSubmissionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
