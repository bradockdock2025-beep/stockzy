import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(email: string, password: string, context?: AuditContext) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const refreshExpiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';

    const refreshToken = await this.issueRefreshToken(user.id, refreshExpiresIn);

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      this.getJwtSecret(),
      { expiresIn },
    );

    await this.auditLog.log({
      action: 'login',
      entity: 'user',
      entityId: user.id,
      after: { success: true },
      context,
      actor: { id: user.id, email: user.email, role: user.role },
    });

    return {
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing || existing.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, role: true, email: true, isActive: true, name: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const refreshExpiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';

    const newRefreshToken = await this.issueRefreshToken(user.id, refreshExpiresIn);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      this.getJwtSecret(),
      { expiresIn },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(refreshToken: string, context?: AuditContext) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, user: { select: { email: true, role: true } } },
    });

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (existing) {
      await this.auditLog.log({
        action: 'logout',
        entity: 'user',
        entityId: existing.userId,
        after: { success: true },
        context,
        actor: {
          id: existing.userId,
          email: existing.user?.email ?? null,
          role: existing.user?.role ?? null,
        },
      });
    }

    return { success: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: AuditContext,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const saltRounds = this.getSaltRounds();
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.auditLog.log({
      action: 'password_change',
      entity: 'user',
      entityId: userId,
      after: { passwordChanged: true },
      context: { ...context, actorId: userId },
    });

    return { success: true };
  }

  private getJwtSecret() {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET is not configured');
    }
    return secret;
  }

  private parseDurationToMs(raw: string, fallbackMs: number) {
    const value = raw.trim();
    const match = value.match(/^(\d+)([smhd])$/i);

    if (!match) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric * 1000;
      }
      return fallbackMs;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      return fallbackMs;
    }

    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000;

    return amount * multiplier;
  }

  private getSaltRounds() {
    const raw = this.configService.get<string>('BCRYPT_SALT_ROUNDS');
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }
    return parsed;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueRefreshToken(userId: string, expiresIn: string) {
    const ttlMs = this.parseDurationToMs(expiresIn, 7 * 24 * 60 * 60 * 1000);
    const token = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }
}
