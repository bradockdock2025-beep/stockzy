import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RecommendationsCron {
  private readonly logger = new Logger(RecommendationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── A cada 4 horas: recomputa todos os sinais de co-ocorrência ───────────

  @Cron(CronExpression.EVERY_4_HOURS)
  async computeCoOccurrences() {
    this.logger.log('Iniciando cálculo de co-ocorrências...');
    await Promise.all([
      this.computeCoPurchase(),
      this.computeCoCart(),
      this.computeCoView(),
    ]);
    await this.invalidateCache();
    this.logger.log('Co-ocorrências actualizadas.');
  }

  // ─── Domingo às 03:00: purge de views antigas (> 90 dias) ─────────────────

  @Cron('0 3 * * 0')
  async purgeOldViews() {
    const deleted = await this.prisma.$executeRaw`
      DELETE FROM product_views
      WHERE viewed_at < now() - interval '90 days'
    `;
    this.logger.log(`Purge de visualizações antigas: ${deleted} registos eliminados.`);
  }

  // ─── Fase 1: Co-Compra (order_items) ─────────────────────────────────────

  private async computeCoPurchase() {
    await this.prisma.$executeRaw`
      DELETE FROM product_co_occurrences WHERE signal = 'co_purchase'
    `;

    await this.prisma.$executeRaw`
      WITH order_pairs AS (
        SELECT
          a.product_id AS product_id_a,
          b.product_id AS product_id_b,
          COUNT(DISTINCT oi_a.order_id) AS pair_count
        FROM order_items oi_a
        JOIN order_items oi_b
          ON  oi_a.order_id  = oi_b.order_id
          AND oi_a.variant_id != oi_b.variant_id
        JOIN product_variants a ON oi_a.variant_id = a.id
        JOIN product_variants b ON oi_b.variant_id = b.id
        WHERE a.product_id != b.product_id
          AND oi_a.created_at >= now() - interval '30 days'
        GROUP BY a.product_id, b.product_id
        HAVING COUNT(DISTINCT oi_a.order_id) >= 2
      ),
      product_totals AS (
        SELECT pv.product_id, COUNT(DISTINCT oi.order_id) AS total
        FROM order_items oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        WHERE oi.created_at >= now() - interval '30 days'
        GROUP BY pv.product_id
      )
      INSERT INTO product_co_occurrences
        (product_id_a, product_id_b, signal, score, pair_count, updated_at)
      SELECT
        op.product_id_a,
        op.product_id_b,
        'co_purchase',
        op.pair_count::numeric / SQRT(ta.total::numeric * tb.total::numeric),
        op.pair_count,
        now()
      FROM order_pairs op
      JOIN product_totals ta ON ta.product_id = op.product_id_a
      JOIN product_totals tb ON tb.product_id = op.product_id_b
      ON CONFLICT (product_id_a, product_id_b, signal)
      DO UPDATE SET
        score      = EXCLUDED.score,
        pair_count = EXCLUDED.pair_count,
        updated_at = now()
    `;

    this.logger.log('co_purchase calculado.');
  }

  // ─── Fase 1: Co-Carrinho (cart_items) ────────────────────────────────────

  private async computeCoCart() {
    await this.prisma.$executeRaw`
      DELETE FROM product_co_occurrences WHERE signal = 'co_cart'
    `;

    await this.prisma.$executeRaw`
      WITH cart_pairs AS (
        SELECT
          a.product_id AS product_id_a,
          b.product_id AS product_id_b,
          COUNT(DISTINCT ci_a.cart_id) AS pair_count
        FROM cart_items ci_a
        JOIN cart_items ci_b
          ON  ci_a.cart_id   = ci_b.cart_id
          AND ci_a.variant_id != ci_b.variant_id
        JOIN product_variants a ON ci_a.variant_id = a.id
        JOIN product_variants b ON ci_b.variant_id = b.id
        WHERE a.product_id != b.product_id
          AND ci_a.created_at >= now() - interval '30 days'
        GROUP BY a.product_id, b.product_id
        HAVING COUNT(DISTINCT ci_a.cart_id) >= 2
      ),
      product_totals AS (
        SELECT pv.product_id, COUNT(DISTINCT ci.cart_id) AS total
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.created_at >= now() - interval '30 days'
        GROUP BY pv.product_id
      )
      INSERT INTO product_co_occurrences
        (product_id_a, product_id_b, signal, score, pair_count, updated_at)
      SELECT
        cp.product_id_a,
        cp.product_id_b,
        'co_cart',
        cp.pair_count::numeric / SQRT(ta.total::numeric * tb.total::numeric),
        cp.pair_count,
        now()
      FROM cart_pairs cp
      JOIN product_totals ta ON ta.product_id = cp.product_id_a
      JOIN product_totals tb ON tb.product_id = cp.product_id_b
      ON CONFLICT (product_id_a, product_id_b, signal)
      DO UPDATE SET
        score      = EXCLUDED.score,
        pair_count = EXCLUDED.pair_count,
        updated_at = now()
    `;

    this.logger.log('co_cart calculado.');
  }

  // ─── Fase 2: Co-Visualização (product_views) ──────────────────────────────

  private async computeCoView() {
    // Verifica se a tabela product_views existe e tem dados suficientes
    let hasData: { count: bigint }[] = [];
    try {
      hasData = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM product_views
        WHERE viewed_at >= now() - interval '30 days'
      `;
    } catch {
      // Tabela ainda não criada no banco — skip silencioso
      return;
    }

    if (Number(hasData[0]?.count ?? 0) === 0) return;

    await this.prisma.$executeRaw`
      DELETE FROM product_co_occurrences WHERE signal = 'co_view'
    `;

    await this.prisma.$executeRaw`
      WITH session_pairs AS (
        SELECT
          pv_a.product_id AS product_id_a,
          pv_b.product_id AS product_id_b,
          COUNT(DISTINCT pv_a.session_id) AS pair_count
        FROM product_views pv_a
        JOIN product_views pv_b
          ON  pv_a.session_id  = pv_b.session_id
          AND pv_a.product_id != pv_b.product_id
        WHERE pv_a.viewed_at >= now() - interval '30 days'
        GROUP BY pv_a.product_id, pv_b.product_id
        HAVING COUNT(DISTINCT pv_a.session_id) >= 3
      ),
      product_totals AS (
        SELECT product_id, COUNT(DISTINCT session_id) AS total
        FROM product_views
        WHERE viewed_at >= now() - interval '30 days'
        GROUP BY product_id
      )
      INSERT INTO product_co_occurrences
        (product_id_a, product_id_b, signal, score, pair_count, updated_at)
      SELECT
        sp.product_id_a,
        sp.product_id_b,
        'co_view',
        sp.pair_count::numeric / SQRT(ta.total::numeric * tb.total::numeric),
        sp.pair_count,
        now()
      FROM session_pairs sp
      JOIN product_totals ta ON ta.product_id = sp.product_id_a
      JOIN product_totals tb ON tb.product_id = sp.product_id_b
      ON CONFLICT (product_id_a, product_id_b, signal)
      DO UPDATE SET
        score      = EXCLUDED.score,
        pair_count = EXCLUDED.pair_count,
        updated_at = now()
    `;

    this.logger.log('co_view calculado.');
  }

  // ─── Invalida o cache Redis de todas as recomendações ────────────────────

  private async invalidateCache() {
    await this.redis.deleteByPattern('also-viewed:*');
  }
}
