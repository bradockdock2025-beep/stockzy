import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, product_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly CACHE_TTL = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  async search(query: SearchQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 24;
    const skip  = (page - 1) * limit;

    const cacheKey = this.buildCacheKey(query);
    const cached   = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    // 1. Expandir categoria → IDs recursivos
    const categoryIds = query.categoryId
      ? await this.expandCategoryIds(query.categoryId)
      : undefined;

    // 2. Resolver IDs via full-text search ou LIKE
    const searchText = query.q?.trim();
    const textIds    = searchText
      ? await this.resolveTextIds(searchText, categoryIds)
      : null;

    if (textIds !== null && textIds.length === 0) {
      const empty = this.emptyResponse(page, limit, query);
      await this.setCache(cacheKey, empty);
      return empty;
    }

    // 3. WHERE principal do produto
    const productWhere = await this.buildProductWhere(query, categoryIds, textIds);

    // 4. Executar produtos + total + IDs filtrados em paralelo
    const [products, total, allFilteredIds] = await Promise.all([
      this.queryProducts(productWhere, query, skip, limit),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.product.findMany({ where: productWhere, select: { id: true } })
        .then(rows => rows.map(r => r.id)),
    ]);

    // Ordenação especial por desconto (em memória)
    const data = query.sort === 'discount'
      ? this.sortByDiscount(products).slice(skip, skip + limit)
      : products;

    // 5. Sidebar com faceted counts (em paralelo)
    const sidebar = await this.computeSidebar(query, categoryIds, textIds, allFilteredIds);

    const response = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query:          searchText ?? null,
        appliedFilters: this.buildAppliedFilters(query),
      },
      sidebar,
    };

    await this.setCache(cacheKey, response);
    return response;
  }

  async suggestions(query: SuggestionsQueryDto) {
    const q     = query.q.trim();
    const limit = query.limit ?? 6;

    if (q.length < 2) return { data: [] };

    const cacheKey = `cache:suggestions:${q.toLowerCase()}:${limit}`;
    const cached   = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        status: product_status.active,
        variants: { some: { isActive: true } },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id:   true,
        name: true,
        slug: true,
        images: {
          orderBy: { position: 'asc' },
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where:   { isActive: true },
          orderBy: { price: 'asc' },
          take: 1,
          select: { price: true, compareAtPrice: true },
        },
      },
      take: limit,
    });

    const data = products.map(p => ({
      id:             p.id,
      name:           p.name,
      slug:           p.slug,
      image:          p.images[0] ? { url: p.images[0].url, alt: p.images[0].altText ?? null } : null,
      price:          p.variants[0]?.price          ? Number(p.variants[0].price)          : null,
      compareAtPrice: p.variants[0]?.compareAtPrice ? Number(p.variants[0].compareAtPrice) : null,
    }));

    const response = { data };
    await this.setCache(cacheKey, response, 30);
    return response;
  }

  // ─── Texto / FTS ───────────────────────────────────────────────────────────

  private async resolveTextIds(search: string, categoryIds?: string[]): Promise<string[]> {
    const mode = this.config.get<string>('PRODUCT_SEARCH_MODE') ?? 'basic';

    if (mode.toLowerCase() === 'fts') {
      return this.textSearchFts(search, categoryIds);
    }

    return this.textSearchLike(search, categoryIds);
  }

  private async textSearchFts(search: string, categoryIds?: string[]): Promise<string[]> {
    const language     = this.getFtsLanguage();
    const catCondition = categoryIds?.length
      ? Prisma.sql`AND p.category_id IN (${Prisma.join(categoryIds)})`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH q AS (SELECT websearch_to_tsquery(${Prisma.raw(language)}, ${search}) AS query)
      SELECT DISTINCT p.id
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
      CROSS JOIN q
      WHERE p.status = 'active'
        ${catCondition}
        AND EXISTS (SELECT 1 FROM product_variants v2 WHERE v2.product_id = p.id AND v2.is_active = true)
        AND (p.search_vector @@ q.query OR v.search_vector @@ q.query)
    `);

    return rows.map(r => r.id);
  }

  private async textSearchLike(search: string, categoryIds?: string[]): Promise<string[]> {
    const where: Prisma.ProductWhereInput = {
      status: product_status.active,
      variants: { some: { isActive: true } },
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };

    if (categoryIds?.length) where.categoryId = { in: categoryIds };

    return this.prisma.product
      .findMany({ where, select: { id: true } })
      .then(rows => rows.map(r => r.id));
  }

  // ─── Produto WHERE ──────────────────────────────────────────────────────────

  private async buildProductWhere(
    query: SearchQueryDto,
    categoryIds?: string[],
    textIds?: string[] | null,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = { status: product_status.active };

    if (textIds !== null && textIds !== undefined) {
      where.id = { in: textIds };
    }

    if (categoryIds?.length) {
      where.categoryId = { in: categoryIds };
    }

    const variantAnd: Prisma.ProductVariantWhereInput[] = [{ isActive: true }];

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      variantAnd.push({
        price: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
      });
    }

    if (query.inStock === 'true') {
      variantAnd.push({
        inventory: { is: { stockQuantity: { gt: this.prisma.inventory.fields.reservedQuantity } } },
      });
    }

    if (query.hasDiscount === 'true') {
      variantAnd.push({ compareAtPrice: { not: null } });
    }

    const { conditions: facetConditions } = await this.buildFacetVariantConditions(query);
    variantAnd.push(...facetConditions);

    where.variants = { some: { AND: variantAnd } };
    return where;
  }

  /**
   * Fragmentos de filtro por `brand` (Brand própria) e `facets` (genérico, Facet.key) —
   * mesmo formato/convenção usado em ProductsService.buildFacetFragments, pra manter os
   * dois sistemas de busca (catálogo por categoria e busca livre) consistentes entre si.
   */
  private async buildFacetVariantConditions(
    query: SearchQueryDto,
  ): Promise<{ conditions: Prisma.ProductVariantWhereInput[] }> {
    const conditions: Prisma.ProductVariantWhereInput[] = [];

    const brandSlugs = this.parseMultiValue(query.brand);
    if (brandSlugs.length) {
      const brands = await this.prisma.brand.findMany({
        where: { slug: { in: brandSlugs }, isActive: true },
        select: { id: true },
      });

      conditions.push(
        brands.length === 0
          ? { id: { in: [] } }
          : { product: { brandId: { in: brands.map(b => b.id) } } },
      );
    }

    for (const filter of this.parseFacetFilters(query.facets)) {
      const facet = await this.prisma.facet.findUnique({ where: { key: filter.key } });
      if (!facet) {
        conditions.push({ id: { in: [] } });
        continue;
      }

      const facetValues = await this.prisma.facetValue.findMany({
        where: { facetId: facet.id, value: { in: filter.values } },
        select: { id: true },
      });

      if (facetValues.length === 0) {
        conditions.push({ id: { in: [] } });
        continue;
      }

      const valueIds = facetValues.map(v => v.id);
      conditions.push(
        facet.scope === 'variant'
          ? { facetValues: { some: { facetValueId: { in: valueIds } } } }
          : { product: { facetValues: { some: { facetValueId: { in: valueIds } } } } },
      );
    }

    return { conditions };
  }

  // ─── Query de produtos ──────────────────────────────────────────────────────

  private queryProducts(
    where: Prisma.ProductWhereInput,
    query: SearchQueryDto,
    skip: number,
    limit: number,
  ) {
    const include = {
      variants: { where: { isActive: true }, orderBy: { price: 'asc' as const } },
      images:   { orderBy: { position: 'asc' as const } },
      category: true,
    };

    if (query.sort === 'discount') {
      // busca tudo → ordena em memória depois
      return this.prisma.product.findMany({ where, include });
    }

    if (query.sort === 'price_asc' || query.sort === 'price_desc') {
      return this.queryProductsByPrice(where, query.sort, skip, limit, include);
    }

    const orderBy = query.sort === 'newest'
      ? { createdAt: 'desc' as const }
      : { createdAt: 'desc' as const }; // relevance: já filtrado por textIds

    return this.prisma.product.findMany({ where, include, orderBy, skip, take: limit });
  }

  private async queryProductsByPrice(
    where: Prisma.ProductWhereInput,
    sort: 'price_asc' | 'price_desc',
    skip: number,
    limit: number,
    include: object,
  ) {
    const grouped = await this.prisma.productVariant.groupBy({
      by: ['productId'],
      where: { product: where, isActive: true },
      _min: { price: true },
      orderBy: sort === 'price_asc'
        ? [{ _min: { price: 'asc' } }]
        : [{ _min: { price: 'desc' } }],
      skip,
      take: limit,
    });

    const ids      = grouped.map(g => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: include as any,
    });

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    return products.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  }

  private sortByDiscount(products: any[]): any[] {
    return products.sort((a, b) => {
      const disc = (p: any) => {
        const v = p.variants?.[0];
        if (!v || !v.compareAtPrice) return 0;
        const price     = Number(v.price);
        const compareAt = Number(v.compareAtPrice);
        return compareAt > price ? ((compareAt - price) / compareAt) * 100 : 0;
      };
      return disc(b) - disc(a);
    });
  }

  // ─── Sidebar Faceted ────────────────────────────────────────────────────────

  private async computeSidebar(
    query: SearchQueryDto,
    categoryIds: string[] | undefined,
    textIds: string[] | null,
    filteredIds: string[],
  ) {
    const [categories, brands, facets, priceRange, inStockCount, discountCount] = await Promise.all([
      this.sidebarCategories(query, textIds, filteredIds),
      this.sidebarBrands(query, categoryIds, textIds, filteredIds),
      this.sidebarFacets(query, categoryIds, textIds, filteredIds),
      this.sidebarPriceRange(filteredIds),
      this.sidebarCount(filteredIds, 'inStock'),
      this.sidebarCount(filteredIds, 'discount'),
    ]);

    return { categories, brands, facets, priceRange, inStock: { count: inStockCount }, discount: { count: discountCount } };
  }

  // Contagem por categoria — SEM filtro de categoria (para mostrar alternativas)
  private async sidebarCategories(
    query: SearchQueryDto,
    textIds: string[] | null,
    filteredIds: string[],
  ): Promise<Array<{ id: string; name: string; slug: string; count: number }>> {
    if (!filteredIds.length) return [];

    const rows = await this.prisma.$queryRaw<Array<{
      id: string; name: string; slug: string; count: number;
    }>>(Prisma.sql`
      SELECT c.id, c.name, c.slug, COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id IN (${Prisma.join(filteredIds)})
        AND p.status = 'active'
      GROUP BY c.id, c.name, c.slug
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY count DESC
      LIMIT 12
    `);

    return rows;
  }

  // Contagem por marca, com auto-exclusão (ignora o próprio filtro `brand` da query)
  private async sidebarBrands(
    query: SearchQueryDto,
    categoryIds: string[] | undefined,
    textIds: string[] | null,
    filteredIds: string[],
  ): Promise<Array<{ value: string; label: string; count: number }>> {
    const baseIds = await this.filteredIdsExcluding(query, categoryIds, textIds, 'brand');
    if (!baseIds.length) return [];

    const rows = await this.prisma.$queryRaw<Array<{ value: string; label: string; count: number }>>(Prisma.sql`
      SELECT b.slug AS value, b.name AS label, COUNT(DISTINCT p.id)::int AS count
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.id IN (${Prisma.join(baseIds)})
      GROUP BY b.slug, b.name
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY count DESC
      LIMIT 20
    `);

    return rows;
  }

  // IDs filtrados excluindo um filtro de dimensão (para faceted counts com auto-exclusão)
  private async filteredIdsExcluding(
    query: SearchQueryDto,
    categoryIds: string[] | undefined,
    textIds: string[] | null,
    excludeKey: 'brand' | string,
  ): Promise<string[]> {
    const modified: SearchQueryDto = { ...query };

    if (excludeKey === 'brand') {
      modified.brand = undefined;
    } else {
      const remaining = this.parseFacetFilters(query.facets).filter(f => f.key !== excludeKey);
      modified.facets = remaining.length
        ? remaining.map(f => `${f.key}:${f.values.join('|')}`).join(';')
        : undefined;
    }

    const where = await this.buildProductWhere(modified, categoryIds, textIds);
    const rows  = await this.prisma.product.findMany({ where, select: { id: true } });
    return rows.map(r => r.id);
  }

  // Facetas (Facet/FacetValue) com contagem e auto-exclusão — mesmo princípio de
  // ProductsService.getFilters(), sem a camada de visibilidade estática por categoria
  // (category_family/gender_equals), já que a busca livre não tem esse contexto único.
  private async sidebarFacets(
    query: SearchQueryDto,
    categoryIds: string[] | undefined,
    textIds: string[] | null,
    filteredIds: string[],
  ): Promise<Array<{ key: string; name: string; inputType: string; values: Array<{ value: string; label: string; count: number }> }>> {
    if (!filteredIds.length) return [];

    const facets = await this.prisma.facet.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, inputType: true, scope: true },
    });

    const results = await Promise.all(
      facets.map(async (facet) => {
        const baseIds = await this.filteredIdsExcluding(query, categoryIds, textIds, facet.key);
        if (!baseIds.length) return null;

        const rows = facet.scope === 'variant'
          ? await this.prisma.$queryRaw<Array<{ value: string; label: string; count: number }>>(Prisma.sql`
              SELECT fv.value, fv.label, COUNT(DISTINCT p.id)::int AS count
              FROM products p
              JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
              JOIN variant_facet_values vfv ON vfv.variant_id = v.id
              JOIN facet_values fv ON fv.id = vfv.facet_value_id
              WHERE p.id IN (${Prisma.join(baseIds)}) AND fv.facet_id = ${facet.id}
              GROUP BY fv.value, fv.label, fv.sort_order
              HAVING COUNT(DISTINCT p.id) > 0
              ORDER BY fv.sort_order ASC NULLS LAST
            `)
          : await this.prisma.$queryRaw<Array<{ value: string; label: string; count: number }>>(Prisma.sql`
              SELECT fv.value, fv.label, COUNT(DISTINCT p.id)::int AS count
              FROM products p
              JOIN product_facet_values pfv ON pfv.product_id = p.id
              JOIN facet_values fv ON fv.id = pfv.facet_value_id
              WHERE p.id IN (${Prisma.join(baseIds)}) AND fv.facet_id = ${facet.id}
              GROUP BY fv.value, fv.label, fv.sort_order
              HAVING COUNT(DISTINCT p.id) > 0
              ORDER BY fv.sort_order ASC NULLS LAST
            `);

        if (!rows.length) return null;

        return { key: facet.key, name: facet.name, inputType: facet.inputType, values: rows };
      }),
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  // Range de preço dos produtos filtrados
  private async sidebarPriceRange(filteredIds: string[]) {
    if (!filteredIds.length) return { min: null, max: null };

    const result = await this.prisma.productVariant.aggregate({
      where: { productId: { in: filteredIds }, isActive: true },
      _min: { price: true },
      _max: { price: true },
    });

    return {
      min: result._min.price ? Number(result._min.price) : null,
      max: result._max.price ? Number(result._max.price) : null,
    };
  }

  // Count de inStock ou discount nos produtos filtrados
  private async sidebarCount(filteredIds: string[], type: 'inStock' | 'discount'): Promise<number> {
    if (!filteredIds.length) return 0;

    if (type === 'inStock') {
      const rows = await this.prisma.$queryRaw<Array<{ count: unknown }>>(Prisma.sql`
        SELECT COUNT(DISTINCT p.id) AS count
        FROM products p
        JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
        JOIN inventory i ON i.variant_id = v.id
        WHERE p.id IN (${Prisma.join(filteredIds)})
          AND i.stock_quantity > i.reserved_quantity
      `);
      return Number(rows[0]?.count ?? 0);
    }

    const rows = await this.prisma.$queryRaw<Array<{ count: unknown }>>(Prisma.sql`
      SELECT COUNT(DISTINCT p.id) AS count
      FROM products p
      JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
      WHERE p.id IN (${Prisma.join(filteredIds)})
        AND v.compare_at_price IS NOT NULL
        AND v.compare_at_price > v.price
    `);
    return Number(rows[0]?.count ?? 0);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async expandCategoryIds(categoryId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE ct AS (
        SELECT id FROM categories WHERE id = ${categoryId}
        UNION ALL
        SELECT c.id FROM categories c INNER JOIN ct ON c.parent_id = ct.id
      )
      SELECT id FROM ct
    `;
    return rows.map(r => r.id);
  }

  private parseMultiValue(raw?: string | string[]): string[] {
    if (!raw) return [];
    const str = Array.isArray(raw) ? raw.join('|') : raw;
    return str.split(/[|,;]/).map(s => s.trim()).filter(Boolean);
  }

  /** Parseia `facets=key:val1|val2;key2:val3` — key referencia Facet.key (ver schema). */
  private parseFacetFilters(raw?: string): Array<{ key: string; values: string[] }> {
    if (!raw) return [];
    const map = new Map<string, string[]>();

    raw.split(/[;,]/).map(e => e.trim()).filter(Boolean).forEach(entry => {
      const [key, ...rest] = entry.split(/[:=]/);
      const facetKey   = key?.trim();
      const rawValues  = rest.join(':').trim();
      if (!facetKey || !rawValues) return;

      const values = rawValues.split('|').map(s => s.trim()).filter(Boolean);
      if (!values.length) return;

      const existing = map.get(facetKey) ?? [];
      map.set(facetKey, [...new Set([...existing, ...values])]);
    });

    return Array.from(map.entries()).map(([key, values]) => ({ key, values }));
  }

  private getFtsLanguage(): string {
    const raw     = this.config.get<string>('PRODUCT_SEARCH_LANGUAGE') ?? 'simple';
    const allowed = new Set(['simple', 'english', 'portuguese', 'spanish', 'french', 'german', 'italian']);
    return allowed.has(raw.toLowerCase()) ? raw.toLowerCase() : 'simple';
  }

  private buildAppliedFilters(query: SearchQueryDto) {
    return {
      categoryId:  query.categoryId  ?? null,
      minPrice:    query.minPrice    ?? null,
      maxPrice:    query.maxPrice    ?? null,
      inStock:     query.inStock === 'true',
      hasDiscount: query.hasDiscount === 'true',
      brand:       this.parseMultiValue(query.brand),
      facets:      this.parseFacetFilters(query.facets),
      sort:        query.sort ?? 'relevance',
    };
  }

  private emptyResponse(page: number, limit: number, query: SearchQueryDto) {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        query: query.q ?? null,
        appliedFilters: this.buildAppliedFilters(query),
      },
      sidebar: {
        categories: [],
        brands: [],
        facets: [],
        priceRange: { min: null, max: null },
        inStock:    { count: 0 },
        discount:   { count: 0 },
      },
    };
  }

  // ─── Cache ──────────────────────────────────────────────────────────────────

  private buildCacheKey(query: SearchQueryDto): string {
    const pairs = Object.entries(query as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.sort().join(',') : String(v);
        return `${k}=${val}`;
      })
      .sort();
    return `cache:search:${pairs.join('&') || 'all'}`;
  }

  private async getCache<T>(key: string): Promise<T | null> {
    if (!this.redisService.isReady()) return null;
    try {
      return await this.redisService.getJson<T>(key);
    } catch {
      return null;
    }
  }

  private async setCache(key: string, value: unknown, ttl = this.CACHE_TTL) {
    if (!this.redisService.isReady()) return;
    try {
      await this.redisService.setJson(key, value, ttl);
    } catch {
      this.logger.warn(`Failed to write cache key ${key}`);
    }
  }
}
