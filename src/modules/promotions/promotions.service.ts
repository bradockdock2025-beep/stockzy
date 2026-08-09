import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';
import { PromotionTargetDto } from './dto/promotion-target.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto) {
    const targets = this.normalizeTargets(dto.targets);
    const code = this.normalizeCode(dto.code);

    const promotion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          name: dto.name,
          code,
          type: dto.type,
          value: dto.value,
          isActive: dto.isActive ?? true,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          priority: dto.priority ?? 0,
          minSubtotal: dto.minSubtotal ?? null,
          maxUses: dto.maxUses ?? null,
          maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
          label: dto.label ?? null,
        },
      });

      if (targets.length) {
        await tx.promotionTarget.createMany({
          data: targets.map((target) => ({
            promotionId: created.id,
            targetType: target.type,
            productId: target.productId ?? null,
            categoryId: target.categoryId ?? null,
          })),
        });
      }

      return created;
    });

    return this.findOne(promotion.id);
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const data: Prisma.PromotionUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = this.normalizeCode(dto.code);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.minSubtotal !== undefined) data.minSubtotal = dto.minSubtotal ?? null;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses ?? null;
    if (dto.maxUsesPerCustomer !== undefined) {
      data.maxUsesPerCustomer = dto.maxUsesPerCustomer ?? null;
    }
    if (dto.label !== undefined) data.label = dto.label ?? null;

    const targets = dto.targets ? this.normalizeTargets(dto.targets) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data,
      });

      if (targets) {
        await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
        if (targets.length) {
          await tx.promotionTarget.createMany({
            data: targets.map((target) => ({
              promotionId: id,
              targetType: target.type,
              productId: target.productId ?? null,
              categoryId: target.categoryId ?? null,
            })),
          });
        }
      }
    });

    return this.findOne(id);
  }

  async findOne(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        targets: true,
        _count: { select: { usages: true } },
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  async findAll(query: QueryPromotionDto) {
    const where: Prisma.PromotionWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.code) {
      where.code = { equals: this.normalizeCode(query.code), mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      let data: Prisma.PromotionGetPayload<{ include: { targets: true } }>[] = [];
      try {
        data = await this.prisma.promotion.findMany({
          where,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: query.cursor },
          skip: 1,
          include: { targets: true, _count: { select: { usages: true } } },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new BadRequestException('Invalid cursor');
        }
        throw error;
      }

      return {
        data,
        meta: {
          limit,
          nextCursor: data.length === limit ? data[data.length - 1]?.id : null,
        },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { targets: true, _count: { select: { usages: true } } },
      }),
      this.prisma.promotion.count({ where }),
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

  async validateCode(code: string) {
    const normalized = this.normalizeCode(code);
    if (!normalized) {
      return { valid: false };
    }

    const now = new Date();
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        code: { equals: normalized, mode: 'insensitive' },
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    });

    if (!promotion) {
      return { valid: false };
    }

    if (promotion.maxUses !== null) {
      const totalUses = await this.prisma.promotionUsage.count({
        where: { promotionId: promotion.id },
      });
      if (totalUses >= promotion.maxUses) {
        return { valid: false };
      }
    }

    return {
      valid: true,
      type: promotion.type,
      value: Number(promotion.value),
      minSubtotal: promotion.minSubtotal ? Number(promotion.minSubtotal) : null,
      maxUsesPerCustomer: promotion.maxUsesPerCustomer ?? null,
      expiresAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
      label: promotion.label ?? null,
    };
  }

  async deactivate(id: string) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private normalizeTargets(targets: PromotionTargetDto[] | undefined) {
    if (!targets || !targets.length) {
      return [];
    }

    return targets.map((target) => {
      if (target.type === 'product' && !target.productId) {
        throw new BadRequestException('productId is required for product targets');
      }
      if (target.type === 'category' && !target.categoryId) {
        throw new BadRequestException('categoryId is required for category targets');
      }
      if (target.type === 'cart') {
        return { type: 'cart' as const };
      }
      return target;
    });
  }

  private normalizeCode(code?: string | null) {
    if (code === undefined || code === null) {
      return null;
    }
    const trimmed = code.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.toUpperCase();
  }
}
