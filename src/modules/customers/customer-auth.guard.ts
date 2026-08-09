import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseAuthService } from './supabase-auth.service';
import { AuditContextStore } from '../../common/audit/audit-context.store';
import { RedisService } from '../../common/redis/redis.service';

type CustomerAuthPayload = {
  authUserId: string;
  email: string | null;
  accessToken: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
};

const CACHE_TTL = 240; // 4 minutes — below Supabase JWT default of 5 min

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{
        headers?: Record<string, unknown>;
        customerAuth?: CustomerAuthPayload;
        user?: unknown;
      }>();
    const authHeader = request.headers?.['authorization'];
    const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!rawHeader || typeof rawHeader !== 'string') {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Faça login ou registre-se para continuar.',
      });
    }

    const token = rawHeader.toLowerCase().startsWith('bearer ')
      ? rawHeader.slice(7)
      : rawHeader;

    const cacheKey = `auth:token:${createHash('sha256').update(token).digest('hex')}`;
    const redisClient = this.redis.getClient();

    let payload: CustomerAuthPayload | null = null;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        payload = JSON.parse(cached) as CustomerAuthPayload;
        payload.accessToken = token;
      }
    }

    if (!payload) {
      const user = await this.supabaseAuth.getUserFromToken(token);
      if (!user) {
        throw new UnauthorizedException({
          code: 'AUTH_INVALID',
          message: 'Sessão expirada ou inválida. Faça login novamente.',
        });
      }

      const userRecord = user as unknown as Record<string, unknown>;
      payload = {
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
    }

    request.customerAuth = payload;

    request.user = {
      sub: payload.authUserId,
      email: payload.email,
      role: 'customer',
    };

    AuditContextStore.merge({
      actorId: payload.authUserId,
      actorEmail: payload.email,
      actorRole: 'customer',
    });

    return true;
  }

  private parseDate(value: unknown) {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
