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
import { PrismaService } from '../../database/prisma.service';
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

  private async uploadToHeroBucket(file: Express.Multer.File, slot: 'desktop' | 'mobile'): Promise<string> {
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

  // ── Hero ──────────────────────────────────────────────────────────────────

  async getHero() {
    return this.prisma.heroBanner.findFirst({ where: { isActive: true } });
  }

  async upsertHero(dto: UpdateHeroDto) {
    const existing = await this.prisma.heroBanner.findFirst();

    if (existing) {
      const data: Record<string, unknown> = {};
      if (dto.desktopImage !== undefined) data.desktopImage = dto.desktopImage;
      if (dto.mobileImage !== undefined) data.mobileImage = dto.mobileImage ?? null;
      if (dto.eyebrow !== undefined) data.eyebrow = dto.eyebrow ?? null;
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel;
      if (dto.ctaHref !== undefined) data.ctaHref = dto.ctaHref;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      return this.prisma.heroBanner.update({ where: { id: existing.id }, data });
    }

    return this.prisma.heroBanner.create({
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

  async uploadHeroImages(files?: {
    desktopImage?: Express.Multer.File[];
    mobileImage?: Express.Multer.File[];
  }) {
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

    if (existing) {
      return this.prisma.heroBanner.update({ where: { id: existing.id }, data });
    }

    return this.prisma.heroBanner.create({
      data: {
        desktopImage: data.desktopImage ?? '',
        mobileImage: data.mobileImage ?? null,
        title: '',
        ctaLabel: '',
        ctaHref: '',
      },
    });
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

  async createTile(dto: CreateTileDto) {
    return this.prisma.homepageTile.create({
      data: {
        section: dto.section ?? null,
        title: dto.title,
        href: dto.href,
        imageSrc: dto.imageSrc,
        mobileImageSrc: dto.mobileImageSrc ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTile(id: string, dto: UpdateTileDto) {
    await this.findTileOrFail(id);

    const data: Record<string, unknown> = {};
    if (dto.section !== undefined) data.section = dto.section ?? null;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.href !== undefined) data.href = dto.href;
    if (dto.imageSrc !== undefined) data.imageSrc = dto.imageSrc;
    if (dto.mobileImageSrc !== undefined) data.mobileImageSrc = dto.mobileImageSrc ?? null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.homepageTile.update({ where: { id }, data });
  }

  async removeTile(id: string) {
    await this.findTileOrFail(id);
    return this.prisma.homepageTile.delete({ where: { id } });
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

  async upsertSocialConfig(dto: UpdateSocialConfigDto) {
    const existing = await this.prisma.socialFeedConfig.findFirst();

    if (existing) {
      const data: Record<string, unknown> = {};
      if (dto.handle !== undefined) data.handle = dto.handle;
      if (dto.followHref !== undefined) data.followHref = dto.followHref;
      return this.prisma.socialFeedConfig.update({ where: { id: existing.id }, data });
    }

    return this.prisma.socialFeedConfig.create({
      data: {
        handle: dto.handle ?? '',
        followHref: dto.followHref ?? '',
      },
    });
  }

  async createSocialImage(dto: CreateSocialImageDto) {
    return this.prisma.socialFeedImage.create({
      data: {
        src: dto.imageSrc,
        alt: dto.alt,
        href: dto.href ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSocialImage(id: string, dto: UpdateSocialImageDto) {
    await this.findSocialImageOrFail(id);

    const data: Record<string, unknown> = {};
    if (dto.imageSrc !== undefined) data.src = dto.imageSrc;
    if (dto.alt !== undefined) data.alt = dto.alt;
    if (dto.href !== undefined) data.href = dto.href ?? null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.socialFeedImage.update({ where: { id }, data });
  }

  async removeSocialImage(id: string) {
    await this.findSocialImageOrFail(id);
    return this.prisma.socialFeedImage.delete({ where: { id } });
  }

  private async findSocialImageOrFail(id: string) {
    const image = await this.prisma.socialFeedImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Social image not found');
    return image;
  }
}
