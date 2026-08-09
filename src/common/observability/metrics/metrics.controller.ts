import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (process.env.NODE_ENV === 'production') {
      const allowed = (process.env.METRICS_ALLOWED_IPS ?? '127.0.0.1,::1')
        .split(',')
        .map((s) => s.trim());
      if (!allowed.includes(req.ip ?? '')) {
        throw new ForbiddenException();
      }
    }
    res.setHeader('Content-Type', this.metrics.getContentType());
    return this.metrics.getMetrics();
  }
}
