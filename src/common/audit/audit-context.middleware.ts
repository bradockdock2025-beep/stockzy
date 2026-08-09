import { Injectable, NestMiddleware } from '@nestjs/common';
import { buildAuditContext } from './audit-context';
import { AuditContextStore } from './audit-context.store';

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(
    req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    _res: unknown,
    next: () => void,
  ) {
    const context = buildAuditContext(req);
    AuditContextStore.run(context, () => next());
  }
}
