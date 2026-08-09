import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService implements OnModuleInit {
  private enabled = false;
  private ignoredPatterns: string[] = [];
  private readonly logger = new Logger(SentryService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const sentryEnv = this.configService.get<string>('SENTRY_ENV') ?? nodeEnv;
    const enabledRaw = this.configService.get<string>('SENTRY_ENABLED');
    const enabled = this.resolveEnabled(enabledRaw, nodeEnv);
    if (!dsn || !enabled) {
      this.logger.warn('Sentry disabled (SENTRY_DSN not set or SENTRY_ENABLED=false).');
      return;
    }

    this.ignoredPatterns = this.getIgnoredPatterns();
    const release = this.getRelease();

    Sentry.init({
      dsn,
      environment: sentryEnv,
      release: release ?? undefined,
      tracesSampleRate: this.getTraceSampleRate(nodeEnv),
    });

    this.enabled = true;
    this.logger.log('Sentry initialized.');
  }

  isEnabled() {
    return this.enabled;
  }

  captureException(
    exception: unknown,
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
  ) {
    if (!this.enabled) {
      return;
    }

    if (this.shouldIgnore(exception)) {
      return;
    }

    Sentry.withScope((scope) => {
      if (context?.tags) {
        for (const [key, value] of Object.entries(context.tags)) {
          scope.setTag(key, value);
        }
      }
      if (context?.extra) {
        scope.setContext('extra', context.extra);
      }
      Sentry.captureException(exception);
    });
  }

  private shouldIgnore(exception: unknown) {
    if (!this.ignoredPatterns.length) {
      return false;
    }

    const message =
      exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
    const normalized = message.toLowerCase();
    return this.ignoredPatterns.some((pattern) => normalized.includes(pattern));
  }

  private getIgnoredPatterns() {
    const raw = this.configService.get<string>('SENTRY_IGNORED_ERRORS');
    if (raw === undefined) {
      return [
        'invalid or expired token',
        'rate limit exceeded',
        'unauthorized',
        'forbidden',
        'not found',
      ];
    }
    if (!raw) {
      return [];
    }
    return raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
  }

  private getRelease() {
    const explicit = this.configService.get<string>('SENTRY_RELEASE');
    if (explicit) {
      return explicit;
    }

    const envRelease = this.configService.get<string>('APP_VERSION');
    if (envRelease) {
      return envRelease;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require(`${process.cwd()}/package.json`) as { version?: string };
      return pkg?.version ?? undefined;
    } catch {
      return undefined;
    }
  }

  private resolveEnabled(raw: string | undefined, env: string) {
    if (raw) {
      if (raw.toLowerCase() === 'false') {
        return false;
      }
      if (raw.toLowerCase() === 'true') {
        return true;
      }
    }

    if (env.toLowerCase() === 'production') {
      return false;
    }

    return true;
  }

  private getNumber(key: string, fallback: number) {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return parsed;
  }

  private getTraceSampleRate(env: string) {
    const raw = this.configService.get<string>('SENTRY_TRACES_SAMPLE_RATE');
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    if (env.toLowerCase() === 'production') {
      return 0.05;
    }

    return 0.1;
  }
}
