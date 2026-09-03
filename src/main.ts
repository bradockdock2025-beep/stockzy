import './common/observability/otel';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Trust first proxy (Railway / Cloudflare) — required for real IP in rate limiting
  app.set('trust proxy', 1);

  // Cookie parser — required for HttpOnly refresh token cookies
  app.use(cookieParser());

  // HTTP security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'"],
        imgSrc:      ["'self'", 'data:', 'https:'],
        connectSrc:  ["'self'", 'https://api.stripe.com', 'https://*.supabase.co'],
        fontSrc:     ["'self'", 'https:'],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        ...(process.env.CSP_REPORT_URI ? { reportUri: [process.env.CSP_REPORT_URI] } : {}),
      },
    },
  }));

  // CORS — restrict to known frontend origins (any localhost port is allowed in development)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [process.env.FRONTEND_URL ?? 'http://localhost:3000'];

  const isDevelopment = (process.env.NODE_ENV ?? 'development') !== 'production';
  const isLocalhostOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDevelopment && isLocalhostOrigin(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-cart-token',
      'idempotency-key',
      'x-idempotency-key',
      'x-admin-key',
      'x-payment-method',
      'stripe-signature',
    ],
    credentials: true,
  });

  // Validate critical secrets at startup
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32');
  }

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
