import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { OrdersQueueService } from '../../../modules/orders/orders.queue.service';

type HttpLabelNames = 'method' | 'route' | 'status';
type QueueLabelNames = 'state';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly enabled: boolean;
  private httpRequestDuration?: Histogram<HttpLabelNames>;
  private httpRequestsTotal?: Counter<HttpLabelNames>;
  private httpRequestErrorsTotal?: Counter<HttpLabelNames>;
  private queueJobs?: Gauge<QueueLabelNames>;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly ordersQueue?: OrdersQueueService,
  ) {
    this.enabled = this.getBoolean('METRICS_ENABLED', true);
    if (!this.enabled) {
      return;
    }

    const serviceName =
      this.configService.get<string>('OTEL_SERVICE_NAME') ?? 'stockzy-ecommerce-api';
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [25, 50, 100, 200, 300, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestErrorsTotal = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP requests with error status',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.queueJobs = new Gauge({
      name: 'orders_queue_jobs',
      help: 'Orders queue job counts by state',
      labelNames: ['state'],
      registers: [this.registry],
    });
  }

  isEnabled() {
    return this.enabled;
  }

  recordHttpRequest(input: {
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }) {
    if (!this.enabled) {
      return;
    }

    const labels = {
      method: input.method,
      route: input.route,
      status: String(input.status),
    };

    this.httpRequestsTotal?.inc(labels);
    this.httpRequestDuration?.observe(labels, input.durationMs);
    if (input.status >= 400) {
      this.httpRequestErrorsTotal?.inc(labels);
    }
  }

  async getMetrics() {
    if (!this.enabled) {
      return '# metrics disabled\n';
    }

    await this.updateQueueMetrics();
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }

  private async updateQueueMetrics() {
    if (!this.queueJobs || !this.ordersQueue) {
      return;
    }

    const counts = await this.ordersQueue.getJobCounts();
    if (!counts) {
      return;
    }

    for (const [state, count] of Object.entries(counts)) {
      const value = typeof count === 'number' && Number.isFinite(count) ? count : 0;
      this.queueJobs.set({ state }, value);
    }
  }

  private getBoolean(key: string, fallback: boolean) {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }
    if (raw.toLowerCase() === 'true') {
      return true;
    }
    if (raw.toLowerCase() === 'false') {
      return false;
    }
    return fallback;
  }
}
