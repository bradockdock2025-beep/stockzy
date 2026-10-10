import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerAuthResolverService, CustomerAuthPayload } from './customer-auth-resolver.service';
import { AuditContextStore } from '../../common/audit/audit-context.store';

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly authResolver: CustomerAuthResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{
        headers?: Record<string, unknown>;
        customerAuth?: CustomerAuthPayload;
        user?: unknown;
      }>();
    const authHeader = request.headers?.['authorization'];
    const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!rawHeader || typeof rawHeader !== 'string') {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Faça login ou registre-se para continuar.',
      });
    }

    const payload = await this.authResolver.resolve(rawHeader);
    if (!payload) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID',
        message: 'Sessão expirada ou inválida. Faça login novamente.',
      });
    }

    request.customerAuth = payload;
    request.user = {
      sub: payload.authUserId,
      email: payload.email,
      role: 'customer',
    };

    AuditContextStore.merge({
      actorId: payload.authUserId,
      actorEmail: payload.email,
      actorRole: 'customer',
    });

    return true;
  }
}
