import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { buildAuditContext } from '../../common/audit/audit-context';

const COOKIE_NAME = 'admin_refresh_token';

function setRefreshCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function msFromExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1]);
  const unit: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (unit[match[2]] ?? 86_400_000);
}

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post('login')
  async login(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const result = await this.authService.login(dto.email, dto.password, buildAuditContext(req));
    setRefreshCookie(res, result.refreshToken, msFromExpiry(result.refreshExpiresIn));
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME] ?? '';
    const result = await this.authService.refresh(token);
    setRefreshCookie(res, result.refreshToken, msFromExpiry(result.refreshExpiresIn));
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string>; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME] ?? '';
    clearRefreshCookie(res);
    return this.authService.logout(token, buildAuditContext(req));
  }

  @Get('me')
  me(@Req() req: { user?: unknown }) {
    return req.user ?? null;
  }

  @Post('change-password')
  changePassword(
    @Req() req: { user?: { sub?: string; email?: string; role?: string }; headers?: Record<string, unknown>; ip?: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user?.sub ?? '',
      dto.currentPassword,
      dto.newPassword,
      buildAuditContext(req),
    );
  }
}
