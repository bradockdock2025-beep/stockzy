import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class RecentlyViewedQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  /**
   * Aceito por compatibilidade, mas ignorado desde 2026-10-10 (PENDENCIAS-BACKEND-GESTAO-
   * RONDA-3.md #2.2) — permitia ler o histórico de qualquer cliente sem autenticação. O
   * `customerId` real vem do `OptionalCustomerAuthGuard`, nunca deste campo.
   */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}
