import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LoginRateLimitGuard, deriveLoginRateLimitKey } from './login-rate-limit.guard';
import { LoginRateLimitService } from './login-rate-limit.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly loginRateLimitService: LoginRateLimitService,
  ) {}

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post('login')
  async login(
    @Req() req: { user?: unknown; headers?: Record<string, unknown>; ip?: string; body?: { email?: string } },
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    let result;
    try {
      result = await this.authService.login(dto.email, dto.password, buildAuditContext(req));
    } catch (error) {
      // PENDENCIAS-BACKEND-GESTAO.md #2.3 — só conta pro limite depois de confirmada a
      // falha de autenticação; login certo nunca chega aqui, então nunca incrementa o
      // contador. Erros que não são de credenciais (timeout de DB, etc.) não devem contar
      // contra o utilizador, senão uma instabilidade de infra vira bloqueio de login.
      if (error instanceof UnauthorizedException) {
        await this.loginRateLimitService.recordFailedAttempt(deriveLoginRateLimitKey(req));
      }
      throw error;
    }
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

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @Req() req: { user?: { sub?: string }; headers?: Record<string, unknown>; ip?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadAvatar(req.user?.sub ?? '', file, buildAuditContext(req));
  }

  @Delete('me/avatar')
  removeAvatar(
    @Req() req: { user?: { sub?: string }; headers?: Record<string, unknown>; ip?: string },
  ) {
    return this.authService.removeAvatar(req.user?.sub ?? '', buildAuditContext(req));
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
