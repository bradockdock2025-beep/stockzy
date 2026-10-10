import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseAuthService } from './supabase-auth.service';
import { RedisService } from '../../common/redis/redis.service';

export type CustomerAuthPayload = {
  authUserId: string;
  email: string | null;
  accessToken: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
};

const CACHE_TTL = 240; // 4 minutes — below Supabase JWT default of 5 min

/**
 * Lógica de verificação de token partilhada entre `CustomerAuthGuard` (exige login) e
 * `OptionalCustomerAuthGuard` (login opcional) — extraída pra não duplicar a verificação
 * de token/cache em dois sítios (PENDENCIAS-BACKEND-GESTAO-RONDA-3.md #2.2).
 */
@Injectable()
export class CustomerAuthResolverService {
  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly redis: RedisService,
  ) {}

  /** Devolve `null` se não houver header, ou se o token for inválido/expirado. */
  async resolve(rawHeader: string | undefined): Promise<CustomerAuthPayload | null> {
    if (!rawHeader || typeof rawHeader !== 'string') {
      return null;
    }

    const token = rawHeader.toLowerCase().startsWith('bearer ')
      ? rawHeader.slice(7)
      : rawHeader;

    const cacheKey = `auth:token:${createHash('sha256').update(token).digest('hex')}`;
    const redisClient = this.redis.getClient();

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const payload = JSON.parse(cached) as CustomerAuthPayload;
        payload.accessToken = token;
        return payload;
      }
    }

    const user = await this.supabaseAuth.getUserFromToken(token);
    if (!user) {
      return null;
    }

    const userRecord = user as unknown as Record<string, unknown>;
    const payload: CustomerAuthPayload = {
      authUserId: user.id,
      email: user.email ?? null,
      accessToken: token,
      phone: typeof userRecord.phone === 'string' ? userRecord.phone : null,
      emailVerifiedAt: this.parseDate(userRecord.email_confirmed_at ?? userRecord.confirmed_at),
      phoneVerifiedAt: this.parseDate(userRecord.phone_confirmed_at),
    };

    if (redisClient) {
      const { accessToken: _, ...cacheable } = payload;
      await redisClient.set(cacheKey, JSON.stringify(cacheable), { EX: CACHE_TTL });
    }

    return payload;
  }

  private parseDate(value: unknown) {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
