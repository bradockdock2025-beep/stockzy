import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CustomerAuthResolverService, CustomerAuthPayload } from './customer-auth-resolver.service';
import { AuditContextStore } from '../../common/audit/audit-context.store';

/**
 * PENDENCIAS-BACKEND-GESTAO-RONDA-3.md #2.2 — pros endpoints `@Public()` de
 * recomendações/histórico, que precisam funcionar tanto pra visitante anónimo quanto pra
 * cliente logado. Nunca bloqueia a requisição: sem header, ou com token invalido/expirado,
 * segue em frente sem `request.customerAuth` (tratado como anónimo). Com token válido,
 * popula `request.customerAuth` igual ao `CustomerAuthGuard` — é o controller/service que
 * decide usar esse `authUserId` (resolvido pro `Customer.id` real) em vez de aceitar um
 * `customerId` arbitrário vindo do query/body, que é o que causava o problema original.
 */
@Injectable()
export class OptionalCustomerAuthGuard implements CanActivate {
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

    const payload = await this.authResolver.resolve(
      typeof rawHeader === 'string' ? rawHeader : undefined,
    );
    if (!payload) {
      return true;
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
