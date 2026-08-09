import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
  ) {}

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
    const result = await this.prisma.$transaction(async (tx) => {
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

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto, context?: AuditContext) {
    const before = await this.findOne(id);

    const updated = await this.prisma.$transaction(async (tx) => {
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
}
