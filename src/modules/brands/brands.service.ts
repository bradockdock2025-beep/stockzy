import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { RedisService } from '../../common/redis/redis.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
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

  /** Mesmas configs de bucket/visibilidade do ProductsService — logo divide o bucket de produto, sob products/brands/. */
  private getStorageSettings() {
    const bucket = this.configService.get<string>('SUPABASE_BUCKET') ?? 'product-images';
    const publicSetting = this.configService.get<string>('SUPABASE_STORAGE_PUBLIC');
    const isPublic = publicSetting ? publicSetting.toLowerCase() === 'true' : true;
    const ttlSetting = this.configService.get<string>('SUPABASE_SIGNED_URL_TTL');
    const parsedTtl = ttlSetting ? Number(ttlSetting) : 60 * 60 * 24 * 7;
    const signedTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 60 * 60 * 24;

    return { bucket, isPublic, signedTtl };
  }

  /**
   * Traduz o P2002 (slug duplicado) do Prisma numa mensagem clara em vez do 500 cru.
   * Mesmo formato de erro do CategoriesService — com o driver adapter (@prisma/adapter-pg)
   * os campos do índice único vêm em `meta.driverAdapterError.cause.constraint.fields`, não
   * em `meta.target` (formato "clássico") — checa os dois pra não depender de uma versão.
   */
  private throwIfDuplicateSlug(error: unknown, slug: string | undefined): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const meta = error.meta as
        | { target?: string[]; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
        | undefined;
      const fields = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
      if (fields.includes('slug')) {
        throw new BadRequestException(`Brand slug "${slug}" is already in use.`);
      }
    }
    throw error;
  }

  /** Mesmo mecanismo de ProductsService.invalidateProductCache — Brand aparece em /products e /catalog/filters. */
  private async invalidateProductCache() {
    if (!this.redisService.isReady()) {
      return;
    }

    try {
      await this.redisService.deleteByPattern('cache:products:*');
    } catch {
      this.logger.warn('Failed to invalidate product cache.');
    }
  }

  async create(dto: CreateBrandDto, context?: AuditContext) {
    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        return tx.brand.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            logoUrl: dto.logoUrl ?? null,
            isActive: dto.isActive ?? true,
          },
        });
      });
    } catch (error) {
      this.throwIfDuplicateSlug(error, dto.slug);
    }

    await this.auditLog.log({
      action: 'create',
      entity: 'brand',
      entityId: result.id,
      after: result,
      context,
    });

    await this.invalidateProductCache();
    return result;
  }

  async findAll(query: QueryBrandDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = {};
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { data, meta: { mode: 'offset' as const, total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto, context?: AuditContext) {
    const before = await this.findOne(id);

    if (dto.isActive === false && before.isActive) {
      const productCount = await this.prisma.product.count({ where: { brandId: id } });
      if (productCount > 0) {
        throw new BadRequestException(
          `Cannot deactivate brand: ${productCount} product(s) still linked to it.`,
        );
      }
    }

    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        return tx.brand.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl ?? null } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
      });
    } catch (error) {
      this.throwIfDuplicateSlug(error, dto.slug);
    }

    await this.auditLog.log({
      action: 'update',
      entity: 'brand',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }

  async remove(id: string, context?: AuditContext) {
    const before = await this.findOne(id);

    const productCount = await this.prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot deactivate brand: ${productCount} product(s) still linked to it.`,
      );
    }

    const updated = await this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.log({
      action: 'deactivate',
      entity: 'brand',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }

  /** Sobe o logótipo pro Supabase Storage e grava a URL em Brand.logoUrl — antes só dava pra setar via logoUrl manual (upload feito por fora do painel). */
  async uploadLogo(id: string, file: Express.Multer.File, context?: AuditContext) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    const detected = await fileTypeFromBuffer(file.buffer);
    const mime = detected?.mime ?? (file.mimetype === 'image/svg+xml' ? 'image/svg+xml' : null);
    if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) {
      throw new BadRequestException(
        `Invalid file: ${file.originalname}. Only JPEG, PNG, WebP and SVG are allowed.`,
      );
    }

    const before = await this.findOne(id);

    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const ext = extname(file.originalname).toLowerCase() || '.png';
    const path = `brands/${id}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    let url: string;
    if (isPublic) {
      url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } else {
      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, signedTtl);
      if (signedError || !signed?.signedUrl) {
        throw new BadRequestException(
          `Failed to generate signed URL: ${signedError?.message ?? 'unknown error'}`,
        );
      }
      url = signed.signedUrl;
    }

    const updated = await this.prisma.brand.update({
      where: { id },
      data: { logoUrl: url },
    });

    await this.auditLog.log({
      action: 'update',
      entity: 'brand',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }
}
