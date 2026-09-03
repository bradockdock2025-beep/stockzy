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

    // Supabase's Supavisor connection pooler presents a cert chain that fails strict
    // Node TLS validation (self-signed intermediate) — this is a property of that
    // specific DATABASE_URL, not of the environment. Previously this was tied to
    // NODE_ENV==='production', which meant the app could only ever connect with
    // NODE_ENV=development — including in a real production deploy (Railway) using
    // this same DATABASE_URL, which would have failed with the exact TLS error this
    // fixes. Default is false (matches what the current Supabase pooler needs);
    // set DATABASE_SSL_REJECT_UNAUTHORIZED=true if the DB host ever has a fully
    // trusted cert chain and strict validation should be re-enabled.
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';

    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized },
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
