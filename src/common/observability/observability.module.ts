import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OrdersModule } from '../../modules/orders/orders.module';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { MetricsService } from './metrics/metrics.service';
import { SentryInterceptor } from './sentry.interceptor';
import { SentryService } from './sentry.service';

@Module({
  imports: [ConfigModule, OrdersModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsMiddleware,
    SentryService,
    { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
