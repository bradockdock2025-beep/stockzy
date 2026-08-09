import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { AuditContext } from '../../common/audit/audit-context';

@Injectable()
export class CategoriesService {
  private readonly productIdSampleLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
  ) {
    this.productIdSampleLimit = this.parseSampleLimit(
      this.configService.get<string>('AUDIT_MOVE_PRODUCTS_SAMPLE_LIMIT'),
    );
  }

  private parseSampleLimit(raw: string | number | undefined): number {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 50;
    }
    return Math.min(Math.floor(parsed), 200);
  }

  async create(dto: CreateCategoryDto, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          code: dto.code,
          parentId: dto.parentId ?? null,
          familyTag: dto.familyTag ?? null,
          bannerTitle: dto.bannerTitle ?? null,
          bannerDescription: dto.bannerDescription ?? null,
        },
      });
    });
  }

  async findAll(query: QueryCategoryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: {
      parentId?: string | null;
      isActive?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = {};

    if (query.parentId) {
      where.parentId = query.parentId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Árvore completa de categorias ativas, pro storefront (menu/navegação) — só campos
   * públicos, sem paginação (o mega menu precisa da árvore inteira de uma vez).
   */
  async findPublicTree() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        familyTag: true,
        bannerTitle: true,
        bannerDescription: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    });

    const byParent = new Map<string | null, typeof categories>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      if (!byParent.has(key)) {
        byParent.set(key, []);
      }
      byParent.get(key)!.push(category);
    }

    const build = (parentId: string | null): Array<(typeof categories)[number] & { children: unknown[] }> =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: build(category.id),
      }));

    return build(null);
  }

  async findPublicOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        familyTag: true,
        bannerTitle: true,
        bannerDescription: true,
        parentId: true,
        isActive: true,
      },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const { isActive: _isActive, ...publicFields } = category;
    return publicFields;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Category not found');
      }

      return tx.category.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          slug: dto.slug ?? undefined,
          code: dto.code ?? undefined,
          parentId: dto.parentId === undefined ? undefined : dto.parentId,
          isActive: dto.isActive ?? undefined,
          familyTag: dto.familyTag === undefined ? undefined : dto.familyTag,
          bannerTitle: dto.bannerTitle === undefined ? undefined : dto.bannerTitle,
          bannerDescription: dto.bannerDescription === undefined ? undefined : dto.bannerDescription,
        },
      });
    });
  }

  async remove(id: string, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Category not found');
      }
      if (!existing.isActive) {
        return existing;
      }

      return tx.category.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }

  async mergeInto(
    sourceId: string,
    targetId: string,
    context?: AuditContext,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('Source and target categories must be different.');
    }

    const productIdSampleLimit = this.productIdSampleLimit;
    let sourceName: string | null = null;
    let targetName: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);

      let productIdSample: string[] | null = null;

      const [source, target] = await Promise.all([
        tx.category.findUnique({ where: { id: sourceId } }),
        tx.category.findUnique({ where: { id: targetId } }),
      ]);

      if (!source) {
        throw new NotFoundException('Source category not found');
      }
      if (!target) {
        throw new NotFoundException('Target category not found');
      }

      sourceName = source.name;
      targetName = target.name;

      const descendants = await this.getCategoryAndDescendantIds(sourceId, tx);
      if (descendants.includes(targetId)) {
        throw new BadRequestException(
          'Cannot merge into a descendant category.',
        );
      }

      const movedChildren = await tx.category.updateMany({
        where: { parentId: sourceId },
        data: { parentId: targetId },
      });

      if (productIdSampleLimit > 0) {
        const productIdRows = await tx.product.findMany({
          where: { categoryId: sourceId },
          select: { id: true },
          take: productIdSampleLimit + 1,
        });
        if (productIdRows.length > 0 && productIdRows.length <= productIdSampleLimit) {
          productIdSample = productIdRows.map((row) => row.id);
        }
      }

      const movedProducts = await tx.product.updateMany({
        where: { categoryId: sourceId },
        data: { categoryId: targetId },
      });

      await tx.category.delete({ where: { id: sourceId } });

      return {
        sourceId,
        targetId,
        movedChildren: movedChildren.count,
        movedProducts: movedProducts.count,
        productIdSample,
      };
    });

    const { productIdSample, ...response } = result;

    await this.auditLog.log({
      action: 'merge',
      entity: 'category',
      entityId: sourceId,
      before: {
        sourceId,
        sourceName,
        targetId,
        targetName,
      },
      after: {
        movedChildren: result.movedChildren,
        movedProducts: result.movedProducts,
      },
      context,
    });

    if (result.movedProducts > 0) {
      const productIdSampleCount = productIdSample?.length ?? 0;
      const includeProductIds =
        productIdSampleLimit > 0 &&
        productIdSampleCount > 0 &&
        result.movedProducts <= productIdSampleLimit &&
        productIdSampleCount === result.movedProducts;
      await this.auditLog.log({
        action: 'move_products',
        entity: 'product',
        entityId: null,
        before: {
          sourceId,
          sourceName,
          targetId,
          targetName,
        },
        after: {
          movedProducts: result.movedProducts,
          ...(includeProductIds ? { productIds: productIdSample } : {}),
        },
        context,
      });
    }

    return response;
  }

  private async getCategoryAndDescendantIds(
    categoryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH RECURSIVE category_tree AS (
        SELECT id, parent_id
        FROM categories
        WHERE id = ${categoryId}
        UNION ALL
        SELECT c.id, c.parent_id
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
      )
      SELECT id FROM category_tree
    `);

    return rows.map((row) => row.id);
  }
}
