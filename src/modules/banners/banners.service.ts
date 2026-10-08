import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannerDto } from './dto/query-banner.dto';

@Injectable()
export class BannersService {
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
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.supabaseClient = createClient(url, key, { auth: { persistSession: false } });
    return this.supabaseClient;
  }

  private getStorageSettings() {
    const bucket = this.configService.get<string>('SUPABASE_BANNERS_BUCKET') ?? 'banners';
    const isPublic =
      (this.configService.get<string>('SUPABASE_STORAGE_PUBLIC') ?? 'true').toLowerCase() === 'true';
    const ttl = Number(this.configService.get<string>('SUPABASE_SIGNED_URL_TTL') ?? 604800);
    return { bucket, isPublic, signedTtl: Number.isFinite(ttl) && ttl > 0 ? ttl : 86400 };
  }

  async create(dto: CreateBannerDto, context?: AuditContext) {
    if (!dto.imageUrl && (dto.isActive ?? true)) {
      throw new BadRequestException(
        'Cannot create an active banner without an image. Create it inactive, upload the image, then activate it.',
      );
    }

    const created = await this.prisma.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        imageUrl: dto.imageUrl ?? '',
        imageWidth: dto.imageWidth ?? null,
        imageHeight: dto.imageHeight ?? null,
        mobileImageUrl: dto.mobileImageUrl ?? null,
        mobileImageWidth: dto.mobileImageWidth ?? null,
        mobileImageHeight: dto.mobileImageHeight ?? null,
        altText: dto.altText ?? null,
        href: dto.href ?? null,
        ctaText: dto.ctaText ?? null,
        ctaLink: dto.ctaLink ?? null,
        context: dto.context ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });

    await this.auditLog.log({
      action: 'create',
      entity: 'banner',
      entityId: created.id,
      after: created,
      context,
    });

    return created;
  }

  async uploadImage(id: string, file: Express.Multer.File, context?: AuditContext) {
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
      throw new BadRequestException(
        `Invalid file: ${file.originalname}. Only JPEG, PNG, WebP and GIF are allowed.`,
      );
    }

    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const ext = extname(file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const path = `banners/${id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      throw new BadRequestException(`Upload falhou: ${uploadError.message}`);
    }

    let imageUrl: string;
    if (isPublic) {
      imageUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } else {
      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, signedTtl);

      if (signedError || !signed?.signedUrl) {
        throw new BadRequestException(`Erro ao gerar URL: ${signedError?.message ?? 'desconhecido'}`);
      }
      imageUrl = signed.signedUrl;
    }

    const updated = await this.prisma.banner.update({ where: { id }, data: { imageUrl } });

    await this.auditLog.log({
      action: 'upload-image',
      entity: 'banner',
      entityId: id,
      before: banner,
      after: updated,
      context,
    });

    return updated;
  }

  async findAll(query: QueryBannerDto) {
    const where: Prisma.BannerWhereInput = {};

    if (query.active === 'true') {
      const now = new Date();
      where.isActive = true;
      where.OR = [
        { startsAt: { equals: null }, endsAt: { equals: null } },
        { startsAt: { lte: now }, endsAt: { equals: null } },
        { startsAt: { equals: null }, endsAt: { gte: now } },
        { startsAt: { lte: now }, endsAt: { gte: now } },
      ];
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      const data = await this.prisma.banner.findMany({
        where,
        take: limit,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        cursor: { id: query.cursor },
        skip: 1,
      });

      return {
        data,
        meta: { mode: 'cursor' as const, limit, nextCursor: data.length === limit ? data[data.length - 1]?.id : null },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.banner.count({ where }),
    ]);

    return { data, meta: { mode: 'offset' as const, total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findActive(context?: string) {
    const now = new Date();
    const where: Prisma.BannerWhereInput = {
      isActive: true,
      OR: [
        { startsAt: { equals: null }, endsAt: { equals: null } },
        { startsAt: { lte: now }, endsAt: { equals: null } },
        { startsAt: { equals: null }, endsAt: { gte: now } },
        { startsAt: { lte: now }, endsAt: { gte: now } },
      ],
    };

    if (context) {
      where.context = context;
    }

    return this.prisma.banner.findMany({ where, orderBy: { position: 'asc' } });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto, context?: AuditContext) {
    const before = await this.findOne(id);

    const effectiveImageUrl = dto.imageUrl ?? before.imageUrl;
    const effectiveIsActive = dto.isActive ?? before.isActive;
    if (!effectiveImageUrl && effectiveIsActive) {
      throw new BadRequestException(
        'Cannot activate a banner without an image. Upload the image first.',
      );
    }

    const data: Prisma.BannerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle ?? null;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.imageWidth !== undefined) data.imageWidth = dto.imageWidth ?? null;
    if (dto.imageHeight !== undefined) data.imageHeight = dto.imageHeight ?? null;
    if (dto.mobileImageUrl !== undefined) data.mobileImageUrl = dto.mobileImageUrl ?? null;
    if (dto.mobileImageWidth !== undefined) data.mobileImageWidth = dto.mobileImageWidth ?? null;
    if (dto.mobileImageHeight !== undefined) data.mobileImageHeight = dto.mobileImageHeight ?? null;
    if (dto.altText !== undefined) data.altText = dto.altText ?? null;
    if (dto.href !== undefined) data.href = dto.href ?? null;
    if (dto.ctaText !== undefined) data.ctaText = dto.ctaText ?? null;
    if (dto.ctaLink !== undefined) data.ctaLink = dto.ctaLink ?? null;
    if (dto.context !== undefined) data.context = dto.context ?? null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    const updated = await this.prisma.banner.update({ where: { id }, data });

    await this.auditLog.log({
      action: 'update',
      entity: 'banner',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async deactivate(id: string, context?: AuditContext) {
    const before = await this.findOne(id);
    const updated = await this.prisma.banner.update({ where: { id }, data: { isActive: false } });

    await this.auditLog.log({
      action: 'deactivate',
      entity: 'banner',
      entityId: id,
      before,
      after: updated,
      context,
    });

    return updated;
  }

  async remove(id: string, context?: AuditContext) {
    const before = await this.findOne(id);
    const removed = await this.prisma.banner.delete({ where: { id } });

    await this.auditLog.log({
      action: 'delete',
      entity: 'banner',
      entityId: id,
      before,
      after: null,
      context,
    });

    return removed;
  }
}
