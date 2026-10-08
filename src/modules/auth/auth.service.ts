import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { extname } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';

@Injectable()
export class AuthService {
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  private getSupabaseClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    return this.supabaseClient;
  }

  private getStorageSettings() {
    const bucket = this.configService.get<string>('SUPABASE_BUCKET') ?? 'product-images';
    const publicSetting = this.configService.get<string>('SUPABASE_STORAGE_PUBLIC');
    const isPublic = publicSetting ? publicSetting.toLowerCase() === 'true' : true;
    const ttlSetting = this.configService.get<string>('SUPABASE_SIGNED_URL_TTL');
    const parsedTtl = ttlSetting ? Number(ttlSetting) : 60 * 60 * 24 * 7;
    const signedTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 60 * 60 * 24;

    return { bucket, isPublic, signedTtl };
  }

  /** Extrai o `path` dentro do bucket a partir de uma URL pública já gerada, pra poder apagar o ficheiro antigo. */
  private extractStoragePath(url: string, bucket: string): string | null {
    const marker = `/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return url.slice(index + marker.length);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined, context?: AuditContext) {
    if (!userId) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
      throw new BadRequestException(
        `Invalid file: ${file.originalname}. Only JPEG, PNG and WebP are allowed.`,
      );
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });
    if (!before) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const path = `users/${userId}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    let avatarUrl: string;
    if (isPublic) {
      avatarUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } else {
      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, signedTtl);
      if (signedError || !signed?.signedUrl) {
        throw new BadRequestException(
          `Failed to generate signed URL: ${signedError?.message ?? 'unknown error'}`,
        );
      }
      avatarUrl = signed.signedUrl;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    if (before.avatarUrl) {
      const oldPath = this.extractStoragePath(before.avatarUrl, bucket);
      if (oldPath) {
        await supabase.storage.from(bucket).remove([oldPath]).catch(() => undefined);
      }
    }

    await this.auditLog.log({
      action: 'upload-image',
      entity: 'user',
      entityId: userId,
      before: { avatarUrl: before.avatarUrl },
      after: { avatarUrl: updated.avatarUrl },
      context,
    });

    return { avatarUrl: updated.avatarUrl };
  }

  async removeAvatar(userId: string, context?: AuditContext) {
    if (!userId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });
    if (!before) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });

    if (before.avatarUrl) {
      const { bucket } = this.getStorageSettings();
      const oldPath = this.extractStoragePath(before.avatarUrl, bucket);
      if (oldPath) {
        await this.getSupabaseClient().storage.from(bucket).remove([oldPath]).catch(() => undefined);
      }
    }

    await this.auditLog.log({
      action: 'update',
      entity: 'user',
      entityId: userId,
      before: { avatarUrl: before.avatarUrl },
      after: { avatarUrl: null },
      context,
    });

    return { avatarUrl: null };
  }

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
        avatarUrl: true,
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
        avatarUrl: user.avatarUrl,
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
      select: { id: true, role: true, email: true, isActive: true, name: true, avatarUrl: true },
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
        avatarUrl: user.avatarUrl,
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
