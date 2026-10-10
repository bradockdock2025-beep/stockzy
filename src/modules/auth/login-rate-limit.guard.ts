import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

type LoginRateLimitRequest = {
  ip?: string;
  headers?: Record<string, unknown>;
  body?: { email?: string };
};

/**
 * Mesma derivação de chave usada pelo guard (pré-checagem) e pelo controller
 * (`recordFailedAttempt`, só depois de confirmada a falha de login) — precisa ser idêntica
 * nos dois pontos, senão o registro da falha cai numa chave diferente da que foi checada.
 */
export function deriveLoginRateLimitKey(request: LoginRateLimitRequest) {
  const forwarded = request.headers?.['x-forwarded-for'];
  const ipHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (typeof ipHeader === 'string' ? ipHeader.split(',')[0] : request.ip) ?? 'unknown';

  const email = request.body?.email?.toLowerCase().trim() ?? 'unknown';
  const key = `${ip}|${email}`;

  return {
    key,
    ip: ip && ip !== 'unknown' ? ip : null,
    email: email && email !== 'unknown' ? email : null,
  };
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: LoginRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LoginRateLimitRequest>();
    await this.rateLimitService.assertNotBlocked(deriveLoginRateLimitKey(request));
    return true;
  }
}
