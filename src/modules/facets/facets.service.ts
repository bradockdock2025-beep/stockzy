import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, facet_visibility } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { RedisService } from '../../common/redis/redis.service';
import { CreateFacetDto } from './dto/create-facet.dto';
import { UpdateFacetDto } from './dto/update-facet.dto';
import { QueryFacetDto } from './dto/query-facet.dto';
import { CreateFacetValueDto } from './dto/create-facet-value.dto';
import { UpdateFacetValueDto } from './dto/update-facet-value.dto';

const VISIBILITY_REQUIRES_VALUE: facet_visibility[] = ['category_family', 'gender_equals'];

@Injectable()
export class FacetsService {
  private readonly logger = new Logger(FacetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
  ) {}

  /** Mesmo mecanismo de ProductsService.invalidateProductCache — Facet/FacetValue aparecem em /products e /catalog/filters. */
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

  private assertVisibilityValue(visibility: facet_visibility | undefined, visibilityValue?: string) {
    if (visibility && VISIBILITY_REQUIRES_VALUE.includes(visibility) && !visibilityValue) {
      throw new BadRequestException(
        `visibilityValue is required when visibility is "${visibility}"`,
      );
    }
  }

  // ─── Facet ──────────────────────────────────────────────────────────────

  async create(dto: CreateFacetDto, context?: AuditContext) {
    this.assertVisibilityValue(dto.visibility, dto.visibilityValue);

    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.facet.create({
        data: {
          key: dto.key,
          name: dto.name,
          inputType: dto.inputType,
          scope: dto.scope ?? 'product',
          visibility: dto.visibility ?? 'always',
          visibilityValue: dto.visibilityValue ?? null,
          sortOrder: dto.sortOrder ?? null,
          isActive: dto.isActive ?? true,
        },
      });
    });

    await this.auditLog.log({
      action: 'create',
      entity: 'facet',
      entityId: result.id,
      after: result,
      context,
    });

    await this.invalidateProductCache();
    return result;
  }

  async findAll(query: QueryFacetDto) {
    const where: Prisma.FacetWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    if (query.scope) {
      where.scope = query.scope;
    }

    return this.prisma.facet.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { values: { orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] } },
    });
  }

  async findOne(id: string) {
    const facet = await this.prisma.facet.findUnique({
      where: { id },
      include: { values: { orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] } },
    });
    if (!facet) throw new NotFoundException('Facet not found');
    return facet;
  }

  private async findFacetOrFail(id: string) {
    const facet = await this.prisma.facet.findUnique({ where: { id } });
    if (!facet) throw new NotFoundException('Facet not found');
    return facet;
  }

  async update(id: string, dto: UpdateFacetDto, context?: AuditContext) {
    const before = await this.findFacetOrFail(id);
    this.assertVisibilityValue(dto.visibility ?? before.visibility, dto.visibilityValue ?? before.visibilityValue ?? undefined);

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.facet.update({
        where: { id },
        data: {
          ...(dto.key !== undefined ? { key: dto.key } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.inputType !== undefined ? { inputType: dto.inputType } : {}),
          ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          ...(dto.visibilityValue !== undefined ? { visibilityValue: dto.visibilityValue ?? null } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });

    await this.auditLog.log({
      action: 'update',
      entity: 'facet',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }

  async remove(id: string, context?: AuditContext) {
    const before = await this.findFacetOrFail(id);

    const updated = await this.prisma.facet.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.log({
      action: 'deactivate',
      entity: 'facet',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }

  // ─── FacetValue ─────────────────────────────────────────────────────────

  async createValue(facetId: string, dto: CreateFacetValueDto, context?: AuditContext) {
    await this.findFacetOrFail(facetId);

    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.facetValue.create({
        data: {
          facetId,
          value: dto.value,
          label: dto.label,
          extra: (dto.extra as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder: dto.sortOrder ?? null,
          isActive: dto.isActive ?? true,
          bannerTitle: dto.bannerTitle ?? null,
          bannerDescription: dto.bannerDescription ?? null,
        },
      });
    });

    await this.auditLog.log({
      action: 'create',
      entity: 'facet_value',
      entityId: result.id,
      after: result,
      context,
    });

    await this.invalidateProductCache();
    return result;
  }

  private async findValueOrFail(facetId: string, id: string) {
    const value = await this.prisma.facetValue.findUnique({ where: { id } });
    if (!value || value.facetId !== facetId) {
      throw new NotFoundException('Facet value not found');
    }
    return value;
  }

  async updateValue(facetId: string, id: string, dto: UpdateFacetValueDto, context?: AuditContext) {
    const before = await this.findValueOrFail(facetId, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.facetValue.update({
        where: { id },
        data: {
          ...(dto.value !== undefined ? { value: dto.value } : {}),
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.extra !== undefined
            ? { extra: (dto.extra as Prisma.InputJsonValue | null) ?? Prisma.JsonNull }
            : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.bannerTitle !== undefined ? { bannerTitle: dto.bannerTitle ?? null } : {}),
          ...(dto.bannerDescription !== undefined
            ? { bannerDescription: dto.bannerDescription ?? null }
            : {}),
        },
      });
    });

    await this.auditLog.log({
      action: 'update',
      entity: 'facet_value',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }

  async removeValue(facetId: string, id: string, context?: AuditContext) {
    const before = await this.findValueOrFail(facetId, id);

    const updated = await this.prisma.facetValue.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.log({
      action: 'deactivate',
      entity: 'facet_value',
      entityId: id,
      before,
      after: updated,
      context,
    });

    await this.invalidateProductCache();
    return updated;
  }
}
