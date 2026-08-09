import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.metrics.isEnabled()) {
      return next();
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const route = this.getRouteLabel(req);
      this.metrics.recordHttpRequest({
        method: req.method ?? 'UNKNOWN',
        route,
        status: res.statusCode ?? 0,
        durationMs,
      });
    });

    next();
  }

  private getRouteLabel(req: Request) {
    const baseUrl = req.baseUrl ?? '';
    const routePath = req.route?.path;
    if (routePath) {
      return `${baseUrl}${routePath}`;
    }

    const originalUrl = req.originalUrl ?? req.url ?? '';
    const pathOnly = originalUrl.split('?')[0];
    return pathOnly || 'unknown';
  }
}
