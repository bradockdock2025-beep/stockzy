import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: isProduction },
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['error', 'warn'],
      transactionOptions: {
        maxWait: 10_000,
        timeout: 20_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
