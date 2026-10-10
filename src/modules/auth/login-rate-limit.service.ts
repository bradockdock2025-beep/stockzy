import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { PrismaService } from '../../database/prisma.service';

type RateLimitEntry = {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
  penaltyLevel?: number;
  penaltyResetAt?: number;
};

@Injectable()
export class LoginRateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly attempts = new Map<string, RateLimitEntry>();
  private readonly ipEmailWindow = new Map<string, { emails: Set<string>; expiresAt: number }>();
  private redis?: RedisClientType;
  private redisUrl: string | null = null;
  private readonly logger = new Logger(LoginRateLimitService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.redisUrl = this.configService.get<string>('REDIS_URL') ?? null;
    if (!this.redisUrl) {
      this.logger.warn('REDIS_URL not configured. Falling back to in-memory rate limiting.');
      return;
    }

    this.redis = createClient({ url: this.redisUrl });
    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error instanceof Error ? error.message : String(error)}`);
    });

    await this.redis.connect();
    this.logger.log('Redis connected for login rate limiting.');
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }

  /**
   * Comportamento antigo (verifica bloqueio e incrementa sempre, sucesso ou falha) — mantido
   * só pra quem ainda não migrou pro par `assertNotBlocked`/`recordFailedAttempt`
   * (hoje, `CustomerRateLimitGuard`, fora do escopo de PENDENCIAS-BACKEND-GESTAO.md #2.3,
   * que trata só do login do painel de gestão).
   */
  async check(payload: { key: string; ip?: string | null; email?: string | null }) {
    await this.assertNotBlocked(payload);
    await this.recordFailedAttempt(payload);
  }

  /**
   * PENDENCIAS-BACKEND-GESTAO.md #2.3 — só verifica se a chave (ou o IP) já está bloqueada;
   * não incrementa nada. Chamado no guard, antes de validar a senha, pra não deixar nem
   * tentar logins quando já está bloqueado. `recordFailedAttempt` é quem incrementa, e só é
   * chamado depois de confirmada a falha de autenticação — login certo nunca conta pro limite.
   */
  async assertNotBlocked(payload: { key: string; ip?: string | null; email?: string | null }) {
    const config = this.resolveConfig();
    const ipKey = payload.ip ? `ip:${payload.ip}` : null;

    if (this.redis) {
      const applyIpLimit = ipKey
        ? await this.shouldApplyIpLimitRedis(
            config.ipMode,
            payload.ip!,
            payload.email ?? null,
            config.ipEmailWindowMs,
            config.ipDistinctEmailsThreshold,
          )
        : false;

      if (ipKey && applyIpLimit) {
        await this.assertKeyNotBlockedRedis(ipKey, config.ipBaseBlockMs);
      }
      await this.assertKeyNotBlockedRedis(payload.key, config.baseBlockMs);
      return;
    }

    const applyIpLimit = ipKey
      ? this.shouldApplyIpLimitMemory(
          config.ipMode,
          payload.ip!,
          payload.email ?? null,
          config.ipEmailWindowMs,
          config.ipDistinctEmailsThreshold,
        )
      : false;

    if (ipKey && applyIpLimit) {
      this.assertKeyNotBlockedMemory(ipKey);
    }
    this.assertKeyNotBlockedMemory(payload.key);
  }

  /**
   * Incrementa o contador de tentativas (e aplica o bloqueio/backoff se passar do limite).
   * Só deve ser chamado depois de confirmada a falha de autenticação.
   */
  async recordFailedAttempt(payload: { key: string; ip?: string | null; email?: string | null }) {
    const config = this.resolveConfig();
    const ipKey = payload.ip ? `ip:${payload.ip}` : null;

    if (this.redis) {
      const applyIpLimit = ipKey
        ? await this.shouldApplyIpLimitRedis(
            config.ipMode,
            payload.ip!,
            payload.email ?? null,
            config.ipEmailWindowMs,
            config.ipDistinctEmailsThreshold,
          )
        : false;

      if (ipKey && applyIpLimit) {
        await this.recordAttemptRedis(
          ipKey,
          config.ipMaxAttempts,
          config.ipWindowMs,
          config.ipBaseBlockMs,
          config.ipMaxBlockMs,
          config.ipPenaltyWindowMs,
          config.ipBackoffMultiplier,
          { ip: payload.ip, email: null },
        );
      }

      await this.recordAttemptRedis(
        payload.key,
        config.maxAttempts,
        config.windowMs,
        config.baseBlockMs,
        config.maxBlockMs,
        config.penaltyWindowMs,
        config.backoffMultiplier,
        { ip: payload.ip, email: payload.email ?? null },
      );
      return;
    }

    const applyIpLimit = ipKey
      ? this.shouldApplyIpLimitMemory(
          config.ipMode,
          payload.ip!,
          payload.email ?? null,
          config.ipEmailWindowMs,
          config.ipDistinctEmailsThreshold,
        )
      : false;

    if (ipKey && applyIpLimit) {
      await this.recordAttemptMemory(ipKey, {
        maxAttempts: config.ipMaxAttempts,
        windowMs: config.ipWindowMs,
        baseBlockMs: config.ipBaseBlockMs,
        maxBlockMs: config.ipMaxBlockMs,
        penaltyWindowMs: config.ipPenaltyWindowMs,
        backoffMultiplier: config.ipBackoffMultiplier,
      }, { ip: payload.ip, email: null });
    }

    await this.recordAttemptMemory(payload.key, {
      maxAttempts: config.maxAttempts,
      windowMs: config.windowMs,
      baseBlockMs: config.baseBlockMs,
      maxBlockMs: config.maxBlockMs,
      penaltyWindowMs: config.penaltyWindowMs,
      backoffMultiplier: config.backoffMultiplier,
    }, { ip: payload.ip, email: payload.email ?? null });
  }

  private resolveConfig() {
    const maxAttempts = this.getNumber('LOGIN_RATE_LIMIT_MAX', 5);
    const windowMs = this.getNumber('LOGIN_RATE_LIMIT_WINDOW_MS', 60_000);
    const baseBlockMs = this.getNumber('LOGIN_RATE_LIMIT_BLOCK_MS', 300_000);
    const maxBlockMs = this.getNumber('LOGIN_RATE_LIMIT_BLOCK_MAX_MS', 3_600_000);
    const penaltyWindowMs = this.getNumber(
      'LOGIN_RATE_LIMIT_PENALTY_WINDOW_MS',
      86_400_000,
    );
    const backoffMultiplier = this.getNumber(
      'LOGIN_RATE_LIMIT_BACKOFF_MULTIPLIER',
      2,
    );

    const ipMaxAttempts = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_MAX',
      Math.max(10, maxAttempts * 2),
    );
    const ipWindowMs = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_WINDOW_MS',
      windowMs,
    );
    const ipBaseBlockMs = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_BLOCK_MS',
      baseBlockMs,
    );
    const ipMaxBlockMs = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_BLOCK_MAX_MS',
      maxBlockMs,
    );
    const ipPenaltyWindowMs = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_PENALTY_WINDOW_MS',
      penaltyWindowMs,
    );
    const ipBackoffMultiplier = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_BACKOFF_MULTIPLIER',
      backoffMultiplier,
    );
    const ipModeRaw = this.configService.get<string>('LOGIN_RATE_LIMIT_IP_MODE');
    const ipMode = (ipModeRaw ?? 'adaptive').toLowerCase();
    const ipDistinctEmailsThreshold = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_DISTINCT_EMAILS_THRESHOLD',
      10,
    );
    const ipEmailWindowMs = this.getNumber(
      'LOGIN_RATE_LIMIT_IP_EMAIL_WINDOW_MS',
      ipWindowMs,
    );

    return {
      maxAttempts, windowMs, baseBlockMs, maxBlockMs, penaltyWindowMs, backoffMultiplier,
      ipMaxAttempts, ipWindowMs, ipBaseBlockMs, ipMaxBlockMs, ipPenaltyWindowMs,
      ipBackoffMultiplier, ipMode, ipDistinctEmailsThreshold, ipEmailWindowMs,
    };
  }

  private async shouldApplyIpLimitRedis(
    mode: string,
    ip: string,
    email: string | null,
    windowMs: number,
    distinctThreshold: number,
  ) {
    if (mode === 'off') {
      return false;
    }

    if (mode === 'strict') {
      return true;
    }

    if (!email) {
      return true;
    }

    const redis = this.redis;
    if (!redis) {
      return true;
    }

    const emailKey = `login:ip:emails:${ip}`;
    await redis.sAdd(emailKey, email);
    const ttl = await redis.pTTL(emailKey);
    if (ttl <= 0) {
      await redis.pExpire(emailKey, windowMs);
    }
    const distinct = await redis.sCard(emailKey);
    return distinct >= distinctThreshold;
  }

  private shouldApplyIpLimitMemory(
    mode: string,
    ip: string,
    email: string | null,
    windowMs: number,
    distinctThreshold: number,
  ) {
    if (mode === 'off') {
      return false;
    }

    if (mode === 'strict') {
      return true;
    }

    if (!email) {
      return true;
    }

    const now = Date.now();
    const entry = this.ipEmailWindow.get(ip);
    if (!entry || entry.expiresAt <= now) {
      const emails = new Set<string>([email]);
      this.ipEmailWindow.set(ip, { emails, expiresAt: now + windowMs });
      return emails.size >= distinctThreshold;
    }

    entry.emails.add(email);
    return entry.emails.size >= distinctThreshold;
  }

  private async assertKeyNotBlockedRedis(key: string, baseBlockMs: number) {
    const redis = this.redis;
    if (!redis) {
      return;
    }

    const blockKey = `login:block:${key}`;
    const isBlocked = await redis.exists(blockKey);
    if (isBlocked) {
      const retryAfterSeconds = await this.getRedisRetryAfterSeconds(blockKey, baseBlockMs);
      this.logger.warn(`Login blocked (redis). key=${key} retryAfter=${retryAfterSeconds}s`);
      throw new HttpException(
        `Too many login attempts. Try again in ${retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordAttemptRedis(
    key: string,
    maxAttempts: number,
    windowMs: number,
    baseBlockMs: number,
    maxBlockMs: number,
    penaltyWindowMs: number,
    backoffMultiplier: number,
    audit: { ip?: string | null; email?: string | null },
  ) {
    const redis = this.redis;
    if (!redis) {
      return;
    }

    const attemptKey = `login:attempts:${key}`;
    const blockKey = `login:block:${key}`;

    const attempts = await redis.incr(attemptKey);
    if (attempts === 1) {
      await redis.pExpire(attemptKey, windowMs);
    }

    if (attempts > maxAttempts) {
      const penaltyKey = `login:penalty:${key}`;
      const penaltyLevel = await redis.incr(penaltyKey);
      const penaltyTtl = await redis.pTTL(penaltyKey);
      if (penaltyTtl <= 0) {
        await redis.pExpire(penaltyKey, penaltyWindowMs);
      }

      const blockMs = this.computeBackoffMs(
        penaltyLevel,
        baseBlockMs,
        maxBlockMs,
        backoffMultiplier,
      );

      await redis.pSetEx(blockKey, blockMs, '1');
      await redis.del(attemptKey);

      this.logger.warn(
        `Login blocked (redis). key=${key} count=${attempts} max=${maxAttempts} penalty=${penaltyLevel} blockMs=${blockMs}`,
      );

      await this.recordBlockAudit({
        key,
        attempts,
        maxAttempts,
        windowMs,
        blockMs,
        penaltyLevel,
        penaltyWindowMs,
        source: 'redis',
        ip: audit.ip ?? null,
        email: audit.email ?? null,
      });
      throw new HttpException(
        `Too many login attempts. Try again in ${Math.ceil(blockMs / 1000)}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(`Login attempt (redis). key=${key} count=${attempts} max=${maxAttempts}`);
  }

  private assertKeyNotBlockedMemory(key: string) {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      this.logger.warn(`Login blocked (memory). key=${key} retryAfter=${retryAfterSeconds}s`);
      throw new HttpException(
        `Too many login attempts. Try again in ${retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordAttemptMemory(
    key: string,
    config: {
      maxAttempts: number;
      windowMs: number;
      baseBlockMs: number;
      maxBlockMs: number;
      penaltyWindowMs: number;
      backoffMultiplier: number;
    },
    audit: { ip?: string | null; email?: string | null },
  ) {
    const now = Date.now();
    const entry = this.attempts.get(key);

    let penaltyLevel = entry?.penaltyLevel ?? 0;
    let penaltyResetAt = entry?.penaltyResetAt ?? 0;

    if (penaltyResetAt <= now) {
      penaltyLevel = 0;
      penaltyResetAt = 0;
    }

    if (!entry || now - entry.firstAttemptAt > config.windowMs) {
      this.attempts.set(key, {
        count: 1,
        firstAttemptAt: now,
        penaltyLevel,
        penaltyResetAt,
      });
      this.logger.debug(
        `Login attempt (memory). key=${key} count=1 max=${config.maxAttempts} penalty=${penaltyLevel}`,
      );
      return;
    }

    const nextCount = entry.count + 1;
    if (nextCount > config.maxAttempts) {
      const nextPenaltyLevel = penaltyLevel + 1;
      const blockMs = this.computeBackoffMs(
        nextPenaltyLevel,
        config.baseBlockMs,
        config.maxBlockMs,
        config.backoffMultiplier,
      );
      penaltyResetAt = now + config.penaltyWindowMs;

      this.attempts.set(key, {
        count: 0,
        firstAttemptAt: now,
        blockedUntil: now + blockMs,
        penaltyLevel: nextPenaltyLevel,
        penaltyResetAt,
      });

      this.logger.warn(
        `Login blocked (memory). key=${key} count=${nextCount} max=${config.maxAttempts} penalty=${nextPenaltyLevel} blockMs=${blockMs}`,
      );

      await this.recordBlockAudit({
        key,
        attempts: nextCount,
        maxAttempts: config.maxAttempts,
        windowMs: config.windowMs,
        blockMs,
        penaltyLevel: nextPenaltyLevel,
        penaltyWindowMs: config.penaltyWindowMs,
        source: 'memory',
        ip: audit.ip ?? null,
        email: audit.email ?? null,
      });
      throw new HttpException(
        `Too many login attempts. Try again in ${Math.ceil(blockMs / 1000)}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.attempts.set(key, {
      ...entry,
      count: nextCount,
      penaltyLevel,
      penaltyResetAt,
    });
    this.logger.debug(
      `Login attempt (memory). key=${key} count=${nextCount} max=${config.maxAttempts} penalty=${penaltyLevel}`,
    );
  }

  private async getRedisRetryAfterSeconds(blockKey: string, blockMs: number) {
    if (!this.redis) {
      return Math.ceil(blockMs / 1000);
    }

    const ttlMs = await this.redis.pTTL(blockKey);
    if (ttlMs > 0) {
      return Math.ceil(ttlMs / 1000);
    }

    return Math.ceil(blockMs / 1000);
  }

  private async recordBlockAudit(params: {
    key: string;
    attempts: number;
    maxAttempts: number;
    windowMs: number;
    blockMs: number;
    penaltyLevel: number;
    penaltyWindowMs: number;
    source: 'redis' | 'memory';
    ip?: string | null;
    email?: string | null;
  }) {
    const { key, attempts, maxAttempts, windowMs, blockMs, penaltyLevel, penaltyWindowMs, source } = params;
    const parsed = this.parseKey(key);
    const ip = params.ip ?? parsed.ip;
    const email = params.email ?? parsed.email;

    try {
      await this.prisma.loginRateLimitAudit.create({
        data: {
          key,
          ip,
          email,
          attempts,
          maxAttempts,
          windowMs,
          blockMs,
          penaltyLevel,
          penaltyWindowMs,
          source,
          blockedUntil: new Date(Date.now() + blockMs),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record login rate limit audit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseKey(key: string) {
    if (key.startsWith('ip:')) {
      const ipOnly = key.slice(3).trim();
      return {
        ip: ipOnly && ipOnly !== 'unknown' ? ipOnly : null,
        email: null,
      };
    }

    const separatorIndex = key.indexOf('|');
    const rawIp = separatorIndex === -1 ? key : key.slice(0, separatorIndex);
    const rawEmail = separatorIndex === -1 ? '' : key.slice(separatorIndex + 1);

    const ip = rawIp.trim();
    const email = rawEmail.trim();

    return {
      ip: ip && ip !== 'unknown' ? ip : null,
      email: email && email !== 'unknown' ? email : null,
    };
  }

  private computeBackoffMs(
    penaltyLevel: number,
    baseBlockMs: number,
    maxBlockMs: number,
    multiplier: number,
  ) {
    const level = Math.max(1, penaltyLevel);
    const safeMultiplier = multiplier >= 1 ? multiplier : 1;
    const maxMs = Math.max(maxBlockMs, baseBlockMs);
    const computed = Math.round(baseBlockMs * Math.pow(safeMultiplier, level - 1));
    return Math.min(computed, maxMs);
  }

  private getNumber(key: string, fallback: number) {
    const raw = this.configService.get<string>(key);
    const parsed = raw ? Number(raw) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
