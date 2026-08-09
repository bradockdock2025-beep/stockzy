import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: LoginRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers?: Record<string, unknown>;
      body?: { email?: string };
    }>();

    const forwarded = request.headers?.['x-forwarded-for'];
    const ipHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = (typeof ipHeader === 'string' ? ipHeader.split(',')[0] : request.ip) ?? 'unknown';

    const email = request.body?.email?.toLowerCase().trim() ?? 'unknown';
    const key = `${ip}|${email}`;

    await this.rateLimitService.check({
      key,
      ip: ip && ip !== 'unknown' ? ip : null,
      email: email && email !== 'unknown' ? email : null,
    });
    return true;
  }
}
