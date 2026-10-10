import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordViewDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  /**
   * Aceito por compatibilidade, mas ignorado desde 2026-10-10 (PENDENCIAS-BACKEND-GESTAO-
   * RONDA-3.md #2.2) — permitia marcar visualizações em nome de qualquer cliente sem
   * autenticação. O `customerId` real vem do `OptionalCustomerAuthGuard`, nunca deste campo.
   */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMs?: number;
}
