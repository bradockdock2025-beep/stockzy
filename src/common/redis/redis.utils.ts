type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
};

export function parseRedisUrl(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);
  const port = url.port ? Number(url.port) : 6379;
  const dbRaw = url.pathname?.replace('/', '') ?? '';
  const db = dbRaw.length > 0 ? Number(dbRaw) : undefined;

  return {
    host: url.hostname,
    port: Number.isFinite(port) ? port : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isFinite(db ?? NaN) ? db : undefined,
  };
}

export type { RedisConnectionOptions };
