import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Redis features will be disabled.');
      return;
    }

    this.client = createClient({ url: redisUrl });
    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error instanceof Error ? error.message : String(error)}`);
    });

    await this.client.connect();
    this.logger.log('Redis connected.');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  getClient(): RedisClientType | null {
    return this.client ?? null;
  }

  isReady(): boolean {
    return !!this.client && this.client.isOpen;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse cached JSON for key ${key}. Clearing cache.`);
      await this.client.del(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    if (!this.client) {
      return;
    }

    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, { EX: ttlSeconds });
      return;
    }

    await this.client.set(key, payload);
  }

  async deleteByPattern(pattern: string, batchSize = 200): Promise<number> {
    if (!this.client) {
      return 0;
    }

    let cursor = '0';
    let deleted = 0;

    do {
      const result = await this.client.scan(cursor, {
        MATCH: pattern,
        COUNT: batchSize,
      });
      cursor = result.cursor;

      if (result.keys.length > 0) {
        deleted += await this.client.del(result.keys);
      }
    } while (cursor !== '0');

    return deleted;
  }
}
