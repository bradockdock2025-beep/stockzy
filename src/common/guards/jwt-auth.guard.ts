import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuditContextStore } from '../audit/audit-context.store';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown>; user?: unknown }>();
    const authHeader = request.headers?.['authorization'];
    const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!rawHeader || typeof rawHeader !== 'string') {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Faça login para continuar.',
      });
    }

    const token = rawHeader.toLowerCase().startsWith('bearer ')
      ? rawHeader.slice(7)
      : rawHeader;

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }

    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload === 'string') {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID',
        message: 'Sessão expirada ou inválida. Faça login novamente.',
      });
      }
      request.user = payload;
      AuditContextStore.merge({
        actorId: typeof payload.sub === 'string' ? payload.sub : null,
        actorEmail: typeof payload.email === 'string' ? payload.email : null,
        actorRole: typeof payload.role === 'string' ? payload.role : null,
      });
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID',
        message: 'Sessão expirada ou inválida. Faça login novamente.',
      });
    }
  }
}
