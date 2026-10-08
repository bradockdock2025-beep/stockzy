import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { CreateTileDto } from './dto/create-tile.dto';
import { UpdateTileDto } from './dto/update-tile.dto';
import { UpdateSocialConfigDto } from './dto/update-social-config.dto';
import { CreateSocialImageDto } from './dto/create-social-image.dto';
import { UpdateSocialImageDto } from './dto/update-social-image.dto';

@Injectable()
export class HomepageService {
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  private getSupabaseClient(): SupabaseClient {
    if (this.supabaseClient) return this.supabaseClient;
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new InternalServerErrorException(
        'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    this.supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return this.supabaseClient;
  }

  private async assertValidImageFile(file: Express.Multer.File) {
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
      throw new BadRequestException(
        `Invalid file: ${file.originalname}. Only JPEG, PNG, WebP and GIF are allowed.`,
      );
    }
  }

  private async uploadToHeroBucket(file: Express.Multer.File, slot: 'desktop' | 'mobile'): Promise<string> {
    await this.assertValidImageFile(file);
    const supabase = this.getSupabaseClient();
    const bucket = this.configService.get<string>('SUPABASE_HERO_BUCKET') ?? 'hero';
    const ext = extname(file.originalname).toLowerCase();
    const path = `${slot}/${randomUUID()}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Mesmo bucket/config do hero, mas usado por tiles e feed social — pasta separa cada um. */
  private async uploadToHomepageBucket(file: Express.Multer.File, folder: string): Promise<string> {
    await this.assertValidImageFile(file);
    const supabase = this.getSupabaseClient();
    const bucket = this.configService.get<string>('SUPABASE_HOMEPAGE_BUCKET') ?? 'homepage';
    const ext = extname(file.originalname).toLowerCase();
    const path = `${folder}/${randomUUID()}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // ── Hero ──────────────────────────────────────────────────────────────────

  async getHero() {
    return this.prisma.heroBanner.findFirst({ where: { isActive: true } });
  }

  /** GET /admin/homepage/hero — vê o hero mesmo inativo (diferente do getHero público). */
  async getHeroForAdmin() {
    return this.prisma.heroBanner.findFirst();
  }

  async upsertHero(dto: UpdateHeroDto, context?: AuditContext) {
    const existing = await this.prisma.heroBanner.findFirst();

    let result;
    if (existing) {
      const data: Record<string, unknown> = {};
      if (dto.desktopImage !== undefined) data.desktopImage = dto.desktopImage;
      if (dto.mobileImage !== undefined) data.mobileImage = dto.mobileImage ?? null;
      if (dto.eyebrow !== undefined) data.eyebrow = dto.eyebrow ?? null;
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel;
      if (dto.ctaHref !== undefined) data.ctaHref = dto.ctaHref;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      result = await this.prisma.heroBanner.update({ where: { id: existing.id }, data });
    } else {
      result = await this.prisma.heroBanner.create({
        data: {
          desktopImage: dto.desktopImage ?? '',
          mobileImage: dto.mobileImage ?? null,
          eyebrow: dto.eyebrow ?? null,
          title: dto.title ?? '',
          ctaLabel: dto.ctaLabel ?? '',
          ctaHref: dto.ctaHref ?? '',
          isActive: dto.isActive ?? true,
        },
      });
    }

    await this.auditLog.log({
      action: existing ? 'update' : 'create',
      entity: 'hero_banner',
      entityId: result.id,
      before: existing ?? null,
      after: result,
      context,
    });

    return result;
  }

  async uploadHeroImages(
    files?: {
      desktopImage?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
    context?: AuditContext,
  ) {
    const desktopFile = files?.desktopImage?.[0];
    const mobileFile = files?.mobileImage?.[0];

    if (!desktopFile && !mobileFile) {
      throw new BadRequestException('Send at least one file: desktopImage or mobileImage');
    }

    const data: Record<string, string> = {};

    if (desktopFile) {
      data.desktopImage = await this.uploadToHeroBucket(desktopFile, 'desktop');
    }
    if (mobileFile) {
      data.mobileImage = await this.uploadToHeroBucket(mobileFile, 'mobile');
    }

    const existing = await this.prisma.heroBanner.findFirst();

    let result;
    if (existing) {
      result = await this.prisma.heroBanner.update({ where: { id: existing.id }, data });
    } else {
      result = await this.prisma.heroBanner.create({
        data: {
          desktopImage: data.desktopImage ?? '',
          mobileImage: data.mobileImage ?? null,
          title: '',
          ctaLabel: '',
          ctaHref: '',
        },
      });
    }

    await this.auditLog.log({
      action: 'upload-hero-images',
      entity: 'hero_banner',
      entityId: result.id,
      before: existing ?? null,
      after: result,
      context,
    });

    return result;
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  async getTiles(section?: string) {
    return this.prisma.homepageTile.findMany({
      where: { isActive: true, ...(section ? { section } : {}) },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /** GET /admin/homepage/tiles — vê tudo, inclusive inativos (diferente do getTiles público). */
  async getTilesForAdmin(section?: string) {
    return this.prisma.homepageTile.findMany({
      where: section ? { section } : undefined,
      orderBy: [{ section: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createTile(dto: CreateTileDto, context?: AuditContext) {
    if (!dto.imageSrc && (dto.isActive ?? true)) {
      throw new BadRequestException(
        'Cannot create an active tile without an image. Create it inactive, upload the image, then activate it.',
      );
    }

    const created = await this.prisma.homepageTile.create({
      data: {
        section: dto.section ?? null,
        title: dto.title,
        href: dto.href,
        imageSrc: dto.imageSrc ?? '',
        mobileImageSrc: dto.mobileImageSrc ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLog.log({
      action: 'create',
      entity: 'homepage_tile',
      entityId: created.id,
      after: created,
      context,
    });

    return created;
  }

  async updateTile(id: string, dto: UpdateTileDto, context?: AuditContext) {
    const before = await this.findTileOrFail(id);

    const effectiveImageSrc = dto.imageSrc ?? before.imageSrc;
    const effectiveIsActive = dto.isActive ?? before.isActive;
    if (!effectiveImageSrc && effectiveIsActive) {
      throw new BadRequestException('Cannot activate a tile without an image. Upload the image first.');
    }

    const data: Record<string, unknown> = {};
    if (dto.section !== undefined) data.section = dto.section ?? null;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.href !== undefined) data.href = dto.href;
    if (dto.imageSrc !== undefined) data.imageSrc = dto.imageSrc;
    if (dto.mobileImageSrc !== undefined) data.mobileImageSrc = dto.mobileImageSrc ?? null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.homepageTile.update({ where: { id }, data });

    await this.auditLog.log({
      action: 'update',
      entity: 'homepage_tile',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async uploadTileImages(
    id: string,
    files: { image?: Express.Multer.File[]; mobileImage?: Express.Multer.File[] } | undefined,
    context?: AuditContext,
  ) {
    const before = await this.findTileOrFail(id);
    const imageFile = files?.image?.[0];
    const mobileFile = files?.mobileImage?.[0];

    if (!imageFile && !mobileFile) {
      throw new BadRequestException('Send at least one file: image or mobileImage');
    }

    const data: Record<string, string> = {};
    if (imageFile) {
      data.imageSrc = await this.uploadToHomepageBucket(imageFile, `tiles/${id}`);
    }
    if (mobileFile) {
      data.mobileImageSrc = await this.uploadToHomepageBucket(mobileFile, `tiles/${id}`);
    }

    const updated = await this.prisma.homepageTile.update({ where: { id }, data });

    await this.auditLog.log({
      action: 'upload-image',
      entity: 'homepage_tile',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async removeTile(id: string, context?: AuditContext) {
    const before = await this.findTileOrFail(id);
    const removed = await this.prisma.homepageTile.delete({ where: { id } });

    await this.auditLog.log({
      action: 'delete',
      entity: 'homepage_tile',
      entityId: id,
      before,
      after: null,
      context,
    });

    return removed;
  }

  private async findTileOrFail(id: string) {
    const tile = await this.prisma.homepageTile.findUnique({ where: { id } });
    if (!tile) throw new NotFoundException('Tile not found');
    return tile;
  }

  // ── Social ────────────────────────────────────────────────────────────────

  async getSocial() {
    const [config, images] = await Promise.all([
      this.prisma.socialFeedConfig.findFirst(),
      this.prisma.socialFeedImage.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }],
      }),
    ]);
    return { config, images };
  }

  /** GET /admin/homepage/social — vê as imagens mesmo inativas (diferente do getSocial público). */
  async getSocialForAdmin() {
    const [config, images] = await Promise.all([
      this.prisma.socialFeedConfig.findFirst(),
      this.prisma.socialFeedImage.findMany({
        orderBy: [{ position: 'asc' }],
      }),
    ]);
    return { config, images };
  }

  async upsertSocialConfig(dto: UpdateSocialConfigDto, context?: AuditContext) {
    const existing = await this.prisma.socialFeedConfig.findFirst();

    let result;
    if (existing) {
      const data: Record<string, unknown> = {};
      if (dto.handle !== undefined) data.handle = dto.handle;
      if (dto.followHref !== undefined) data.followHref = dto.followHref;
      result = await this.prisma.socialFeedConfig.update({ where: { id: existing.id }, data });
    } else {
      result = await this.prisma.socialFeedConfig.create({
        data: {
          handle: dto.handle ?? '',
          followHref: dto.followHref ?? '',
        },
      });
    }

    await this.auditLog.log({
      action: existing ? 'update' : 'create',
      entity: 'social_feed_config',
      entityId: result.id,
      before: existing ?? null,
      after: result,
      context,
    });

    return result;
  }

  async createSocialImage(dto: CreateSocialImageDto, context?: AuditContext) {
    if (!dto.imageSrc && (dto.isActive ?? true)) {
      throw new BadRequestException(
        'Cannot create an active social image without an image. Create it inactive, upload the image, then activate it.',
      );
    }

    const created = await this.prisma.socialFeedImage.create({
      data: {
        src: dto.imageSrc ?? '',
        alt: dto.alt,
        href: dto.href ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLog.log({
      action: 'create',
      entity: 'social_feed_image',
      entityId: created.id,
      after: created,
      context,
    });

    return created;
  }

  async updateSocialImage(id: string, dto: UpdateSocialImageDto, context?: AuditContext) {
    const before = await this.findSocialImageOrFail(id);

    const effectiveSrc = dto.imageSrc ?? before.src;
    const effectiveIsActive = dto.isActive ?? before.isActive;
    if (!effectiveSrc && effectiveIsActive) {
      throw new BadRequestException('Cannot activate a social image without an image. Upload the image first.');
    }

    const data: Record<string, unknown> = {};
    if (dto.imageSrc !== undefined) data.src = dto.imageSrc;
    if (dto.alt !== undefined) data.alt = dto.alt;
    if (dto.href !== undefined) data.href = dto.href ?? null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.socialFeedImage.update({ where: { id }, data });

    await this.auditLog.log({
      action: 'update',
      entity: 'social_feed_image',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async uploadSocialImage(id: string, file: Express.Multer.File | undefined, context?: AuditContext) {
    const before = await this.findSocialImageOrFail(id);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const src = await this.uploadToHomepageBucket(file, `social/${id}`);
    const updated = await this.prisma.socialFeedImage.update({ where: { id }, data: { src } });

    await this.auditLog.log({
      action: 'upload-image',
      entity: 'social_feed_image',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async removeSocialImage(id: string, context?: AuditContext) {
    const before = await this.findSocialImageOrFail(id);
    const removed = await this.prisma.socialFeedImage.delete({ where: { id } });

    await this.auditLog.log({
      action: 'delete',
      entity: 'social_feed_image',
      entityId: id,
      before,
      after: null,
      context,
    });

    return removed;
  }

  private async findSocialImageOrFail(id: string) {
    const image = await this.prisma.socialFeedImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Social image not found');
    return image;
  }
}
