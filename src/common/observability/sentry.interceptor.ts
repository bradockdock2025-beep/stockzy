import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SentryService } from './sentry.service';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly sentry: SentryService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (!this.sentry.isEnabled()) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const routePath = req?.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : undefined;
    const method = req?.method;
    const url = req?.originalUrl;

    return next.handle().pipe(
      catchError((err) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        if (status >= 500) {
          this.sentry.captureException(err, {
            tags: {
              route: routePath ?? 'unknown',
              method: method ?? 'unknown',
              status: String(status),
            },
            extra: {
              url,
            },
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
