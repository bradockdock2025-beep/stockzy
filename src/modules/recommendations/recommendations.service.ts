import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AlsoViewedQueryDto } from './dto/also-viewed-query.dto';
import { RecordViewDto } from './dto/record-view.dto';

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  inStock: boolean;
  image: { url: string; altText: string | null } | null;
  category: { id: string; name: string; slug: string };
}

interface AlsoViewedResponse {
  data: ProductCard[];
  meta: {
    productId: string;
    total: number;
    source: string;
    fallback: boolean;
    cacheHit: boolean;
  };
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly CACHE_TTL = 60 * 60 * 4; // 4 horas

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAlsoViewed(productId: string, query: AlsoViewedQueryDto): Promise<any> {
    const limit = query.limit ?? 8;
    const cacheKey = `also-viewed:${productId}:${limit}`;

    const cached = await this.redis.getJson<AlsoViewedResponse>(cacheKey);
    if (cached) return { ...cached, meta: { ...cached.meta, cacheHit: true } };

    // seenIds garante: sem duplicados + nunca retornar o próprio produto
    const seenIds = new Set<string>([productId]);
    const results: ProductCard[] = [];
    const fromCo: ProductCard[] = [];
    const fromCat: ProductCard[] = [];
    const fromGlobal: ProductCard[] = [];

    // Camada 1 — co-ocorrência comportamental
    try {
      const co = await this.queryCoOccurrences(productId, limit, seenIds);
      for (const p of co) { fromCo.push(p); results.push(p); seenIds.add(p.id); }
    } catch {
      // Tabela ainda não criada no banco — continua para camada 2
    }

    // Camada 2 — melhores da mesma categoria
    if (results.length < limit) {
      const needed = limit - results.length;
      const cat = await this.fallbackByCategory(productId, needed, seenIds);
      for (const p of cat) { fromCat.push(p); results.push(p); seenIds.add(p.id); }
    }

    // Camada 3 — melhores globais (completa até ao limit)
    if (results.length < limit) {
      const needed = limit - results.length;
      const global = await this.fallbackGlobalBestSellers(productId, needed, seenIds);
      for (const p of global) { fromGlobal.push(p); results.push(p); seenIds.add(p.id); }
    }

    // source reflete a camada de maior prioridade que contribuiu resultados
    const source =
      fromCo.length > 0 ? 'co_occurrence'
      : fromCat.length > 0 ? 'category_bestsellers'
      : 'global_bestsellers';

    // fallback é true sempre que foi necessário usar camadas de preenchimento
    const fallback = fromCat.length > 0 || fromGlobal.length > 0;

    const response: AlsoViewedResponse = {
      data: results,
      meta: { productId, total: results.length, source, fallback, cacheHit: false },
    };

    await this.redis.setJson(cacheKey, response, this.CACHE_TTL);
    return response;
  }

  async recordView(productId: string, body: RecordViewDto, req: Request): Promise<void> {
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '';
    const ipHash = rawIp ? crypto.createHash('sha256').update(rawIp).digest('hex') : null;
    const userAgent = (req.headers['user-agent'] ?? null) as string | null;

    // Dedup: ignora se a mesma sessão já visualizou este produto nos últimos 30 min
    const recent = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM product_views
      WHERE product_id = ${productId}::uuid
        AND session_id  = ${body.sessionId}
        AND viewed_at  >= now() - interval '30 minutes'
      LIMIT 1
    `;

    if (recent.length > 0) {
      if (body.durationMs) {
        await this.prisma.$executeRaw`
          UPDATE product_views
          SET duration_ms = ${body.durationMs}
          WHERE id = ${recent[0].id}::uuid
        `;
      }
      return;
    }

    const customerId = body.customerId ?? null;

    await this.prisma.$executeRaw`
      INSERT INTO product_views
        (product_id, customer_id, session_id, ip_hash, user_agent, duration_ms)
      VALUES (
        ${productId}::uuid,
        ${customerId}::uuid,
        ${body.sessionId},
        ${ipHash},
        ${userAgent},
        ${body.durationMs ?? null}
      )
    `;
  }

  /** GET /catalog/recently-viewed — últimos produtos distintos vistos nesta sessão/cliente. */
  async getRecentlyViewed(
    sessionId: string,
    customerId: string | undefined,
    limit: number,
  ): Promise<{ data: ProductCard[] }> {
    const rows = customerId
      ? await this.prisma.$queryRaw<{ product_id: string }[]>`
          SELECT product_id, MAX(viewed_at) AS last_viewed
          FROM product_views
          WHERE session_id = ${sessionId} OR customer_id = ${customerId}::uuid
          GROUP BY product_id
          ORDER BY last_viewed DESC
          LIMIT ${limit}
        `
      : await this.prisma.$queryRaw<{ product_id: string }[]>`
          SELECT product_id, MAX(viewed_at) AS last_viewed
          FROM product_views
          WHERE session_id = ${sessionId}
          GROUP BY product_id
          ORDER BY last_viewed DESC
          LIMIT ${limit}
        `;

    const data = await this.fetchProductCards(rows.map((r) => r.product_id));
    return { data };
  }

  /**
   * GET /catalog/recommended — "Recommended For You" da home, sem produto-âncora.
   * Infere a categoria mais vista pela sessão/cliente (histórico de ProductView) e
   * devolve os mais vendidos dessa categoria; sem histórico ou sem match, cai pros
   * mais vendidos globais — mesmas camadas de fallback do getAlsoViewed.
   */
  async getRecommendedForYou(
    sessionId: string | undefined,
    customerId: string | undefined,
    limit: number,
  ): Promise<{ data: ProductCard[]; meta: { source: 'category_history' | 'global_bestsellers' } }> {
    if (sessionId || customerId) {
      const rows = customerId
        ? await this.prisma.$queryRaw<{ category_id: string }[]>`
            SELECT p.category_id, COUNT(*) AS cnt
            FROM product_views pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.session_id = ${sessionId} OR pv.customer_id = ${customerId}::uuid
            GROUP BY p.category_id
            ORDER BY cnt DESC
            LIMIT 1
          `
        : await this.prisma.$queryRaw<{ category_id: string }[]>`
            SELECT p.category_id, COUNT(*) AS cnt
            FROM product_views pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.session_id = ${sessionId}
            GROUP BY p.category_id
            ORDER BY cnt DESC
            LIMIT 1
          `;

      const preferredCategoryId = rows[0]?.category_id;
      if (preferredCategoryId) {
        const data = await this.fetchCategoryBestSellers(preferredCategoryId, limit, new Set());
        if (data.length > 0) {
          return { data, meta: { source: 'category_history' } };
        }
      }
    }

    const data = await this.fallbackGlobalBestSellers('', limit, new Set());
    return { data, meta: { source: 'global_bestsellers' } };
  }

  // ─── Queries Privadas ─────────────────────────────────────────────────────

  private async queryCoOccurrences(
    productId: string,
    limit: number,
    seenIds: Set<string>,
  ): Promise<ProductCard[]> {
    // Busca com buffer para compensar exclusões de seenIds
    const fetchLimit = limit + seenIds.size + 10;

    const rows = await this.prisma.$queryRaw<{ product_id_b: string }[]>`
      SELECT
        product_id_b,
        SUM(
          score::float8 * CASE signal
            WHEN 'co_view'     THEN 0.50
            WHEN 'co_purchase' THEN 0.35
            WHEN 'co_cart'     THEN 0.15
            ELSE 0
          END
        ) AS weighted_score
      FROM product_co_occurrences
      WHERE product_id_a = ${productId}::uuid
      GROUP BY product_id_b
      ORDER BY weighted_score DESC
      LIMIT ${fetchLimit}
    `;

    if (rows.length === 0) return [];

    const filteredIds = rows
      .map((r) => r.product_id_b)
      .filter((id) => !seenIds.has(id))
      .slice(0, limit);

    return this.fetchProductCards(filteredIds);
  }

  private async fallbackByCategory(
    productId: string,
    needed: number,
    seenIds: Set<string>,
  ): Promise<ProductCard[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!product) return [];

    return this.fetchCategoryBestSellers(product.categoryId, needed, seenIds);
  }

  private async fetchCategoryBestSellers(
    categoryId: string,
    needed: number,
    seenIds: Set<string>,
  ): Promise<ProductCard[]> {
    const fetchLimit = needed + seenIds.size + 10;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      LEFT JOIN product_rankings pr ON pr.product_id = p.id
      WHERE p.category_id = ${categoryId}::uuid
        AND p.status = 'active'
        AND EXISTS (
          SELECT 1 FROM product_variants pv
          JOIN inventory i ON i.variant_id = pv.id
          WHERE pv.product_id = p.id
            AND pv.is_active = true
            AND i.stock_quantity > 0
        )
      ORDER BY COALESCE(pr.score, 0) DESC, p.created_at DESC
      LIMIT ${fetchLimit}
    `;

    const filteredIds = rows
      .map((r) => r.id)
      .filter((id) => !seenIds.has(id))
      .slice(0, needed);

    if (filteredIds.length === 0) return [];
    return this.fetchProductCards(filteredIds);
  }

  private async fallbackGlobalBestSellers(
    productId: string,
    needed: number,
    seenIds: Set<string>,
  ): Promise<ProductCard[]> {
    const fetchLimit = needed + seenIds.size + 10;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      LEFT JOIN product_rankings pr ON pr.product_id = p.id
      WHERE p.status = 'active'
      ORDER BY COALESCE(pr.score, 0) DESC
      LIMIT ${fetchLimit}
    `;

    const filteredIds = rows
      .map((r) => r.id)
      .filter((id) => !seenIds.has(id))
      .slice(0, needed);

    if (filteredIds.length === 0) return [];
    return this.fetchProductCards(filteredIds);
  }

  private async fetchProductCards(ids: string[]): Promise<ProductCard[]> {
    if (ids.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, status: 'active' },
      select: {
        id: true,
        name: true,
        slug: true,
        category: { select: { id: true, name: true, slug: true } },
        images: {
          where: { variantId: null },
          orderBy: { position: 'asc' },
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
          take: 1,
          select: {
            price: true,
            compareAtPrice: true,
            inventory: { select: { stockQuantity: true } },
          },
        },
      },
    });

    // Preservar a ordem dos IDs (ordenada por score)
    const byId = new Map(products.map((p) => [p.id, p]));

    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => {
        const v = p!.variants[0];
        const price = v ? Number(v.price) : 0;
        const compareAtPrice = v?.compareAtPrice ? Number(v.compareAtPrice) : null;
        const discountPercent =
          compareAtPrice && compareAtPrice > price
            ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
            : null;
        const inStock = (v?.inventory?.stockQuantity ?? 0) > 0;

        return {
          id: p!.id,
          name: p!.name,
          slug: p!.slug,
          price,
          compareAtPrice,
          discountPercent,
          inStock,
          image: p!.images[0] ?? null,
          category: p!.category,
        };
      });
  }
}
