import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RankingsService {
  private readonly logger = new Logger(RankingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshRankings() {
    this.logger.log('Iniciando actualização do ranking de produtos...');

    try {
      await this.prisma.$executeRaw`
        INSERT INTO product_rankings (
          product_id,
          units_sold_7d,
          units_sold_30d,
          units_sold_all,
          score,
          updated_at
        )
        SELECT
          v.product_id,
          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.created_at >= NOW() - INTERVAL '7 days'
          ), 0) AS units_sold_7d,

          COALESCE(SUM(oi.quantity) FILTER (
            WHERE o.created_at >= NOW() - INTERVAL '30 days'
          ), 0) AS units_sold_30d,

          COALESCE(SUM(oi.quantity), 0) AS units_sold_all,

          (
            COALESCE(SUM(oi.quantity) FILTER (
              WHERE o.created_at >= NOW() - INTERVAL '7 days'
            ), 0) * 3.0 +
            COALESCE(SUM(oi.quantity) FILTER (
              WHERE o.created_at >= NOW() - INTERVAL '30 days'
            ), 0) * 1.5 +
            COALESCE(SUM(oi.quantity), 0) * 0.5
          ) AS score,

          now() AS updated_at

        FROM order_items oi
        JOIN orders o        ON o.id = oi.order_id
        JOIN product_variants v ON v.id = oi.variant_id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY v.product_id

        ON CONFLICT (product_id) DO UPDATE SET
          units_sold_7d  = EXCLUDED.units_sold_7d,
          units_sold_30d = EXCLUDED.units_sold_30d,
          units_sold_all = EXCLUDED.units_sold_all,
          score          = EXCLUDED.score,
          updated_at     = now()
      `;

      await this.invalidateBestSellersCache();

      this.logger.log('Ranking de produtos actualizado com sucesso.');
    } catch (error) {
      this.logger.error('Falha ao actualizar ranking de produtos.', error);
    }
  }

  private async invalidateBestSellersCache() {
    if (!this.redisService.isReady()) return;
    try {
      await this.redisService.deleteByPattern('cache:sections:best-sellers:*');
    } catch {
      this.logger.warn('Falha ao invalidar cache de best-sellers.');
    }
  }

  async getLastUpdated(): Promise<Date | null> {
    const result = await this.prisma.productRanking.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return result?.updatedAt ?? null;
  }
}
