import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
    const expected = this.configService.get<string>('ADMIN_API_KEY');

    if (!expected) {
      throw new InternalServerErrorException('ADMIN_API_KEY is not configured');
    }

    const rawHeader =
      request.headers?.['x-admin-key'] ??
      request.headers?.['x-api-key'] ??
      request.headers?.['authorization'];

    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const token =
      typeof headerValue === 'string' && headerValue.toLowerCase().startsWith('bearer ')
        ? headerValue.slice(7)
        : headerValue;

    if (!token) {
      throw new UnauthorizedException('Invalid admin key');
    }

    const tokenBuf = Buffer.from(String(token));
    const expectedBuf = Buffer.from(expected);

    if (
      tokenBuf.length !== expectedBuf.length ||
      !timingSafeEqual(tokenBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid admin key');
    }

    return true;
  }
}
