import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, product_status } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { RedisService } from '../../common/redis/redis.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { QuerySectionDto } from './dto/query-section.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { isUUID } from 'class-validator';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';

@Injectable()
export class ProductsService {
  private supabaseClient: SupabaseClient | null = null;
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly redisService: RedisService,
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

  private getStorageSettings() {
    const bucket = this.configService.get<string>('SUPABASE_BUCKET') ?? 'product-images';
    const publicSetting = this.configService.get<string>('SUPABASE_STORAGE_PUBLIC');
    const isPublic = publicSetting ? publicSetting.toLowerCase() === 'true' : true;
    const ttlSetting = this.configService.get<string>('SUPABASE_SIGNED_URL_TTL');
    const parsedTtl = ttlSetting ? Number(ttlSetting) : 60 * 60 * 24 * 7;
    const signedTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 60 * 60 * 24;

    return { bucket, isPublic, signedTtl };
  }

  private getProductsCacheTtlSeconds(): number {
    const raw = this.configService.get<string>('PRODUCTS_CACHE_TTL_SECONDS');
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 60;
  }

  private normalizeCacheParams(params?: Record<string, unknown>): string {
    if (!params) {
      return 'all';
    }

    const entries = Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      return true;
    });

    if (entries.length === 0) {
      return 'all';
    }

    const pairs = entries
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          const normalized = value.map((item) => String(item)).sort();
          return [key, normalized.join(',')] as const;
        }
        return [key, String(value)] as const;
      })
      .sort(([a], [b]) => a.localeCompare(b));

    return pairs
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private buildCacheKey(prefix: string, params?: Record<string, unknown>): string {
    const suffix = this.normalizeCacheParams(params);
    return `${prefix}:${suffix}`;
  }

  private async getCache<T>(key: string): Promise<T | null> {
    if (!this.redisService.isReady()) {
      return null;
    }

    try {
      return await this.redisService.getJson<T>(key);
    } catch (error) {
      this.logger.warn(`Failed to read cache for key ${key}.`);
      return null;
    }
  }

  private async setCache(key: string, value: unknown) {
    if (!this.redisService.isReady()) {
      return;
    }

    try {
      await this.redisService.setJson(key, value, this.getProductsCacheTtlSeconds());
    } catch (error) {
      this.logger.warn(`Failed to write cache for key ${key}.`);
    }
  }

  private addAvailability(product: any): any {
    return {
      ...product,
      variants: (product.variants ?? []).map((v: any) => {
        const available = Math.max(
          0,
          (v.inventory?.stockQuantity ?? 0) - (v.inventory?.reservedQuantity ?? 0),
        );

        let purchaseMode: 'normal' | 'presale' | 'sold_out' | 'presale_sold_out';
        if (v.presaleEnabled) {
          const remaining = v.presaleRemaining ?? null;
          purchaseMode = remaining === 0 ? 'presale_sold_out' : 'presale';
        } else {
          purchaseMode = available > 0 ? 'normal' : 'sold_out';
        }

        return {
          ...v,
          availableQuantity: available,
          isAvailable: available > 0,
          purchaseMode,
        };
      }),
    };
  }

  /**
   * Projeção enxuta do card de grid (BACKEND-ENDPOINT-PRODUCTS.md §7) — usada só pelo
   * controller público de listagem. Espera um produto já passado por addAvailability().
   * O admin (ProductsAdminController) continua chamando findAll() sem essa projeção,
   * pois precisa dos dados completos (SKU, estoque, variantes) pra gestão de catálogo.
   */
  toListItem(product: any): {
    id: string;
    name: string;
    image: string | null;
    brand: { name: string; logoUrl: string | null } | null;
    priceFrom: number | null;
    featured: boolean;
  } {
    const images = [...(product.images ?? [])].sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
    );
    const image = images[0]?.url ?? null;
    const brand = product.brand
      ? { name: product.brand.name as string, logoUrl: (product.brand.logoUrl as string) ?? null }
      : null;

    const variants = product.variants ?? [];
    const availableVariants = variants.filter((v: any) => v.isAvailable);
    const priceSource = availableVariants.length ? availableVariants : variants;
    const priceFrom = priceSource.length
      ? Math.min(...priceSource.map((v: any) => Number(v.price)))
      : null;

    return {
      id: product.id,
      name: product.name,
      image,
      brand,
      priceFrom,
      featured: product.featured,
    };
  }

  private async invalidateProductCache() {
    if (!this.redisService.isReady()) {
      return;
    }

    try {
      await this.redisService.deleteByPattern('cache:products:*');
    } catch (error) {
      this.logger.warn('Failed to invalidate product cache.');
    }
  }

  private async getProductAuditSnapshot(
    id: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        variants: {
          include: {
            inventory: true,
          },
        },
      },
    });
  }

  private normalizeSkuPart(value: string, maxLength = 12): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, maxLength);
  }

  private async getSkuContext(
    categoryId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ departmentCode: string; categoryCode: string; year: number; scope: string }> {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        code: true,
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const categoryCode = category.code?.trim().toUpperCase();
    const departmentCode = category.parent?.code?.trim().toUpperCase() ?? categoryCode;

    if (!categoryCode || !departmentCode) {
      throw new BadRequestException(
        'Category codes are required for SKU generation. Configure category.code.',
      );
    }

    const year = new Date().getFullYear();
    const scope = `${departmentCode}-${categoryCode}-${year}`;

    return { departmentCode, categoryCode, year, scope };
  }

  private async getNextSkuSequence(
    scope: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ last_number: number }>>(Prisma.sql`
      INSERT INTO sku_sequences (scope, last_number, created_at, updated_at)
      VALUES (${scope}, 1, now(), now())
      ON CONFLICT (scope) DO UPDATE
      SET last_number = sku_sequences.last_number + 1,
          updated_at = now()
      RETURNING last_number;
    `);

    if (!rows[0]?.last_number) {
      throw new InternalServerErrorException('Failed to generate SKU sequence');
    }

    return rows[0].last_number;
  }

  private async generateSkuBase(
    context: { departmentCode: string; categoryCode: string; year: number; scope: string },
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const seq = await this.getNextSkuSequence(context.scope, tx);
    const padded = String(seq).padStart(6, '0');

    return `${context.departmentCode}-${context.categoryCode}-${context.year}-${padded}`;
  }

  private async getSkuFacetInfo(
    tx: Prisma.TransactionClient,
    variants: Array<{ facetValueIds?: string[] }>,
  ): Promise<{
    colorFacetId: string | null;
    sizeFacetIds: string[];
    valueById: Map<string, { value: string; facetId: string }>;
  }> {
    const facets = await tx.facet.findMany({
      where: { key: { in: ['color', 'size_men', 'size_women', 'size_kids'] } },
      select: { id: true, key: true },
    });
    const colorFacetId = facets.find((f) => f.key === 'color')?.id ?? null;
    const sizeFacetIds = facets.filter((f) => f.key.startsWith('size_')).map((f) => f.id);

    const allIds = variants.flatMap((v) => v.facetValueIds ?? []);
    const values = allIds.length
      ? await tx.facetValue.findMany({
          where: { id: { in: allIds } },
          select: { id: true, value: true, facetId: true },
        })
      : [];

    return { colorFacetId, sizeFacetIds, valueById: new Map(values.map((v) => [v.id, v])) };
  }

  private getFacetSkuValue(
    facetValueIds: string[] | undefined,
    facetIds: string[] | string | null,
    valueById: Map<string, { value: string; facetId: string }>,
    maxLength: number,
  ): string | null {
    if (!facetValueIds?.length || !facetIds) {
      return null;
    }

    const idSet = new Set(Array.isArray(facetIds) ? facetIds : [facetIds]);
    const found = facetValueIds
      .map((id) => valueById.get(id))
      .find((v): v is { value: string; facetId: string } => !!v && idSet.has(v.facetId));

    if (!found) {
      return null;
    }

    const normalized = this.normalizeSkuPart(found.value, maxLength);
    return normalized.length ? normalized : null;
  }


  /** Parseia `facets=key:val1|val2;key2:val3` — key referencia Facet.key (ver schema). */
  private parseFacetFilters(raw?: string): Array<{ key: string; values: string[] }> {
    if (!raw) {
      return [];
    }

    const value = Array.isArray(raw) ? raw.join(',') : raw;
    const map = new Map<string, string[]>();

    value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const [key, ...rest] = entry.split(/[:=]/);
        const facetKey = key?.trim();
        const rawValues = rest.join(':').trim();

        if (!facetKey || !rawValues) {
          return;
        }

        const values = rawValues
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean);

        if (!values.length) {
          return;
        }

        const existing = map.get(facetKey) ?? [];
        map.set(facetKey, [...new Set([...existing, ...values])]);
      });

    return Array.from(map.entries()).map(([key, values]) => ({ key, values }));
  }

  private parseAttributeValues(raw?: string | string[]): string[] {
    if (!raw) {
      return [];
    }

    const value = Array.isArray(raw) ? raw.join('|') : raw;

    return value
      .split(/[|,;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  /** Ordena valores de uma faceta por sortOrder (cadastro), com fallback alfabético. */
  private sortFacetValues<T extends { value: string; sortOrder: number | null }>(values: T[]): T[] {
    const sorted = [...values].sort((a, b) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return a.value.localeCompare(b.value, 'pt-BR', { sensitivity: 'base' });
    });

    return sorted;
  }

  /**
   * Regra de visibilidade da faceta (Facet.visibility, ver buildingConcept/
   * BACKEND-ENDPOINT-CATALOG-FILTERS.md — tabela facet_rules). "gender_equals" assume,
   * por convenção, que a faceta de gênero tem key = "gender".
   */
  private isFacetVisible(
    facet: { key: string; visibility: string; visibilityValue: string | null },
    ctx: { activeCategoryFamilyTag: string | null; activeFacetFilters: Array<{ key: string; values: string[] }> },
  ): boolean {
    const valuesFor = (key: string) =>
      ctx.activeFacetFilters.find((f) => f.key === key)?.values ?? [];

    switch (facet.visibility) {
      case 'category_family':
        return !!facet.visibilityValue && facet.visibilityValue === ctx.activeCategoryFamilyTag;
      case 'gender_fixed_absent':
        return valuesFor(facet.key).length === 0;
      case 'gender_equals':
        return valuesFor('gender').includes(facet.visibilityValue ?? '');
      case 'always':
      default:
        return true;
    }
  }

  /** Filtros sempre aplicados, nunca excluídos no cálculo de contagem por faceta (ver getFilters). */
  private buildBaseVariantFilter(query: QueryProductDto): Prisma.ProductVariantWhereInput {
    const base: Prisma.ProductVariantWhereInput = { isActive: true };

    if (query.minPrice !== undefined || query.maxPrice !== undefined || query.belowRetail === 'true') {
      base.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        // "Below Retail" — preço atual abaixo do compareAtPrice cadastrado
        ...(query.belowRetail === 'true'
          ? { lt: this.prisma.productVariant.fields.compareAtPrice }
          : {}),
      };
    }

    if (query.inStock === 'true') {
      base.inventory = {
        is: {
          stockQuantity: { gt: this.prisma.inventory.fields.reservedQuantity },
        },
      };
    }

    return base;
  }

  /**
   * Monta um fragmento AND-ável por faceta ativa na query — `brand` (Brand própria) e
   * `facets` (genérico, referencia Facet.key). GET /products combina todos os fragmentos;
   * GET /catalog/filters combina todos exceto o da própria faceta sendo contada
   * (auto-exclusão, ver buildingConcept/BACKEND-ENDPOINT-CATALOG-FILTERS.md). Facetas com
   * scope=product filtram via Product.facetValues; scope=variant via ProductVariant.facetValues.
   */
  private async buildFacetFragments(
    query: QueryProductDto,
  ): Promise<{
    facets: Array<{ key: string; condition: Prisma.ProductVariantWhereInput }>;
    forceEmpty: boolean;
  }> {
    const facets: Array<{ key: string; condition: Prisma.ProductVariantWhereInput }> = [];
    let forceEmpty = false;

    const brandSlugs = this.parseAttributeValues(query.brand);
    if (brandSlugs.length) {
      const brands = await this.prisma.brand.findMany({
        where: { slug: { in: brandSlugs }, isActive: true },
        select: { id: true },
      });

      if (brands.length === 0) {
        forceEmpty = true;
        facets.push({ key: 'brand', condition: { id: { in: [] } } });
      } else {
        facets.push({
          key: 'brand',
          condition: { product: { brandId: { in: brands.map((b) => b.id) } } },
        });
      }
    }

    const facetFilters = this.parseFacetFilters(query.facets);
    for (const filter of facetFilters) {
      const facet = await this.prisma.facet.findUnique({ where: { key: filter.key } });

      if (!facet) {
        // Faceta desconhecida: fragmento impossível, mas ainda entra na lista (com essa
        // key) pra que as outras facetas continuem excluindo-o só quando forem elas mesmas.
        forceEmpty = true;
        facets.push({ key: filter.key, condition: { id: { in: [] } } });
        continue;
      }

      const facetValues = await this.prisma.facetValue.findMany({
        where: { facetId: facet.id, value: { in: filter.values } },
        select: { id: true },
      });

      if (facetValues.length === 0) {
        forceEmpty = true;
        facets.push({ key: facet.key, condition: { id: { in: [] } } });
        continue;
      }

      const valueIds = facetValues.map((v) => v.id);
      const condition: Prisma.ProductVariantWhereInput =
        facet.scope === 'variant'
          ? { facetValues: { some: { facetValueId: { in: valueIds } } } }
          : { product: { facetValues: { some: { facetValueId: { in: valueIds } } } } };

      facets.push({ key: facet.key, condition });
    }

    return { facets, forceEmpty };
  }

  private async buildVariantFilters(
    query: QueryProductDto,
  ): Promise<{ variantFilters: Prisma.ProductVariantWhereInput; forceEmpty: boolean }> {
    const base = this.buildBaseVariantFilter(query);
    const { facets, forceEmpty } = await this.buildFacetFragments(query);

    if (forceEmpty) {
      return { variantFilters: { ...base, id: { in: [] } }, forceEmpty: true };
    }

    const variantFilters: Prisma.ProductVariantWhereInput = { ...base };
    if (facets.length > 0) {
      variantFilters.AND = facets.map((facet) => facet.condition);
    }

    return { variantFilters, forceEmpty: false };
  }

  private async getCategoryAndDescendantIds(categoryId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE category_tree AS (
        SELECT id
        FROM categories
        WHERE id = ${categoryId}
        UNION ALL
        SELECT c.id
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
      )
      SELECT id FROM category_tree
    `;

    return rows.map((row) => row.id);
  }

  /**
   * GET /catalog/banner — título + descrição pra topo de /browse/{gender} e
   * /category/{slug} (buildingConcept/PAGE-BROWSE-MEN.md §2). Resolve por `categoryId`
   * (Category.bannerTitle/bannerDescription) ou, na ausência dele, pelo primeiro valor
   * de `facets` com key="gender" (FacetValue.bannerTitle/bannerDescription) — mesmo
   * mecanismo dos outros dois endpoints, sem rota dedicada por gênero/categoria.
   */
  async getBanner(query: QueryProductDto): Promise<{ title: string | null; description: string | null }> {
    if (query.categoryId) {
      if (!isUUID(query.categoryId)) {
        throw new BadRequestException('categoryId must be a UUID');
      }
      const category = await this.prisma.category.findUnique({
        where: { id: query.categoryId },
        select: { name: true, bannerTitle: true, bannerDescription: true },
      });
      if (!category) {
        return { title: null, description: null };
      }
      return {
        title: category.bannerTitle ?? category.name,
        description: category.bannerDescription ?? null,
      };
    }

    const genderFilter = this.parseFacetFilters(query.facets).find((f) => f.key === 'gender');
    if (genderFilter?.values.length) {
      const facetValue = await this.prisma.facetValue.findFirst({
        where: { value: genderFilter.values[0], facet: { key: 'gender' } },
        select: { label: true, bannerTitle: true, bannerDescription: true },
      });
      if (facetValue) {
        return {
          title: facetValue.bannerTitle ?? facetValue.label,
          description: facetValue.bannerDescription ?? null,
        };
      }
    }

    return { title: null, description: null };
  }

  /**
   * GET /catalog/release-calendar — próximos lançamentos (presale), ordenado por
   * expectedAvailableAt. Um produto pode ter várias variantes em presale com datas
   * diferentes; pega a mais próxima por produto (`distinct` + `orderBy` já resolve isso).
   */
  async getReleaseCalendar(query: QuerySectionDto) {
    const limit = query.limit ?? 12;
    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;

    const cacheKey = this.buildCacheKey('cache:sections:release-calendar', {
      limit,
      categoryId: query.categoryId,
    });
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const variants = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        presaleEnabled: true,
        expectedAvailableAt: { gte: new Date() },
        product: {
          status: product_status.active,
          ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        },
      },
      orderBy: { expectedAvailableAt: 'asc' },
      distinct: ['productId'],
      take: limit,
      include: {
        product: {
          include: {
            images: { orderBy: { position: 'asc' }, take: 1 },
            brand: true,
          },
        },
      },
    });

    const data = variants.map((v) => ({
      id: v.product.id,
      name: v.product.name,
      image: v.product.images[0]?.url ?? null,
      brand: v.product.brand
        ? { name: v.product.brand.name, logoUrl: v.product.brand.logoUrl ?? null }
        : null,
      price: Number(v.presalePrice ?? v.price),
      expectedAvailableAt: v.expectedAvailableAt,
    }));

    const response = { data, meta: this.buildSectionMeta('release-calendar', data) };
    await this.setCache(cacheKey, response);
    return response;
  }

  /**
   * GET /catalog/filters — pra cada Facet (e pra Brand) ativa, conta produtos aplicando
   * todos os OUTROS filtros ativos, exceto o dela própria (auto-exclusão, ver
   * buildingConcept/BACKEND-ENDPOINT-CATALOG-FILTERS.md). Facetas cuja contagem zera
   * inteira, ou cuja regra de visibilidade (Facet.visibility) não bate com o contexto
   * atual, somem da resposta. Price é calculado sobre o filtro completo (sem exceção).
   * Categoria devolve os filhos diretos da categoria ativa (ou as raízes, se nenhuma
   * categoryId foi passada).
   */
  async getFilters(query: QueryProductDto) {
    if (query.categoryId && !isUUID(query.categoryId)) {
      throw new BadRequestException('categoryId must be a UUID');
    }

    const cacheKey = this.buildCacheKey(
      'cache:products:filters',
      query as Record<string, unknown>,
    );
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;
    const categoryScope = categoryIds ? { categoryId: { in: categoryIds } } : {};

    const activeCategory = query.categoryId
      ? await this.prisma.category.findUnique({
          where: { id: query.categoryId },
          select: { id: true, name: true, slug: true, familyTag: true },
        })
      : null;

    const base = this.buildBaseVariantFilter(query);
    const { facets: allFacets } = await this.buildFacetFragments(query);
    const activeFacetFilters = this.parseFacetFilters(query.facets);

    // ---- Brand (sempre visível, mesmo mecanismo de auto-exclusão) ----
    const brandOtherConditions = allFacets
      .filter((facet) => facet.key !== 'brand')
      .map((facet) => facet.condition);

    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });

    const brandCounts = await Promise.all(
      brands.map(async (brand) => {
        const count = await this.prisma.product.count({
          where: {
            status: product_status.active,
            ...categoryScope,
            variants: {
              some: {
                ...base,
                AND: [...brandOtherConditions, { product: { brandId: brand.id } } ],
              },
            },
          },
        });
        return { value: brand.slug, label: brand.name, count };
      }),
    );
    const brandBlock = brandCounts.filter((b) => b.count > 0);

    // ---- Facetas genéricas (Facet + FacetValue) ----
    const facetDefs = await this.prisma.facet.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const facetsWithValues: Array<{
      key: string;
      name: string;
      inputType: string;
      values: Array<{ value: string; label: string; count: number }>;
    }> = [];

    for (const facet of facetDefs) {
      const isVisible = this.isFacetVisible(facet, {
        activeCategoryFamilyTag: activeCategory?.familyTag ?? null,
        activeFacetFilters,
      });
      if (!isVisible) {
        continue;
      }

      const values = await this.prisma.facetValue.findMany({
        where: { facetId: facet.id, isActive: true },
        select: { id: true, value: true, label: true, sortOrder: true },
      });
      if (!values.length) {
        continue;
      }

      const otherConditions = allFacets
        .filter((f) => f.key !== facet.key)
        .map((f) => f.condition);

      const counts = await Promise.all(
        values.map(async (value) => {
          const condition: Prisma.ProductVariantWhereInput =
            facet.scope === 'variant'
              ? { facetValues: { some: { facetValueId: value.id } } }
              : { product: { facetValues: { some: { facetValueId: value.id } } } };

          const count = await this.prisma.product.count({
            where: {
              status: product_status.active,
              ...categoryScope,
              variants: { some: { ...base, AND: [...otherConditions, condition] } },
            },
          });
          return { value: value.value, label: value.label, count, sortOrder: value.sortOrder };
        }),
      );

      if (!counts.some((c) => c.count > 0)) {
        continue;
      }

      facetsWithValues.push({
        key: facet.key,
        name: facet.name,
        inputType: facet.inputType,
        values: this.sortFacetValues(counts),
      });
    }

    const fullVariantFilters: Prisma.ProductVariantWhereInput = {
      ...base,
      ...(allFacets.length ? { AND: allFacets.map((facet) => facet.condition) } : {}),
    };

    const priceStats = await this.prisma.productVariant.aggregate({
      where: {
        ...fullVariantFilters,
        product: { status: product_status.active, ...categoryScope },
      },
      _min: { price: true },
      _max: { price: true },
    });

    const childCategories = await this.prisma.category.findMany({
      where: { parentId: query.categoryId ?? null, isActive: true },
      select: { id: true, name: true, slug: true, code: true },
      orderBy: { name: 'asc' },
    });

    const categories = await Promise.all(
      childCategories.map(async (child) => {
        const childIds = await this.getCategoryAndDescendantIds(child.id);
        const count = await this.prisma.product.count({
          where: {
            status: product_status.active,
            categoryId: { in: childIds },
            variants: {
              some: { ...base, ...(allFacets.length ? { AND: allFacets.map((f) => f.condition) } : {}) },
            },
          },
        });
        return { ...child, count };
      }),
    );

    const response = {
      category: activeCategory
        ? { id: activeCategory.id, name: activeCategory.name, slug: activeCategory.slug }
        : null,
      categories,
      brands: brandBlock,
      facets: facetsWithValues,
      priceMin: priceStats._min.price ?? null,
      priceMax: priceStats._max.price ?? null,
    };

    await this.setCache(cacheKey, response);

    return response;
  }

  async create(dto: CreateProductDto, context?: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const skuFacetInfo = await this.getSkuFacetInfo(tx, dto.variants);
      const hasColorSource = !!skuFacetInfo.colorFacetId;

      const needsAutoSku = dto.variants.some((variant) => !variant.sku);
      let skuContext:
        | { departmentCode: string; categoryCode: string; year: number; scope: string }
        | null = null;
      let baseSku: string | null = null;

      if (needsAutoSku) {
        const ensuredContext = await this.getSkuContext(dto.categoryId, tx);
        skuContext = ensuredContext;
        if (hasColorSource) {
          baseSku = await this.generateSkuBase(ensuredContext, tx);
        }
      }

      // 1️⃣ Criar Produto
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          status: dto.status,
          featured: dto.featured,
          categoryId: dto.categoryId,
          brandId: dto.brandId ?? null,
        },
      });

      if (dto.facetValueIds?.length) {
        await this.syncProductFacetValues(tx, product.id, dto.facetValueIds);
      }

      // 2️⃣ Criar Variantes
      for (const variant of dto.variants) {
        let sku = variant.sku;

        if (!sku) {
          const ensuredContext =
            skuContext ?? (skuContext = await this.getSkuContext(dto.categoryId, tx));

          if (hasColorSource) {
            if (!baseSku) {
              baseSku = await this.generateSkuBase(ensuredContext, tx);
            }

            const colorValue = this.getFacetSkuValue(
              variant.facetValueIds,
              skuFacetInfo.colorFacetId,
              skuFacetInfo.valueById,
              12,
            );
            if (!colorValue) {
              throw new BadRequestException(
                'Cor is required for SKU generation. Provide the facetValue or set SKU manually.',
              );
            }

            const sizeValue = this.getFacetSkuValue(
              variant.facetValueIds,
              skuFacetInfo.sizeFacetIds,
              skuFacetInfo.valueById,
              8,
            );
            sku = sizeValue ? `${baseSku}-${colorValue}-${sizeValue}` : `${baseSku}-${colorValue}`;
          } else {
            sku = await this.generateSkuBase(ensuredContext, tx);
          }
        }

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku,
            title: variant.title,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
          },
        });

        await this.recordPriceHistory(tx, {
          variantId: createdVariant.id,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          context,
        });

        // 3️⃣ Criar Inventory
        await tx.inventory.create({
          data: {
            variantId: createdVariant.id,
            stockQuantity: variant.stockQuantity,
          },
        });

        if (variant.facetValueIds?.length) {
          await this.syncVariantFacetValues(tx, createdVariant.id, variant.facetValueIds);
        }
      }

      const snapshot = await this.getProductAuditSnapshot(product.id, tx);
      return { product, snapshot };
    }, { timeout: 60000 });

    await this.invalidateProductCache();

    await this.auditLog.log({
      action: 'create',
      entity: 'product',
      entityId: result.product.id,
      before: null,
      after: result.snapshot,
      context,
    });

    return result.product;
  }
  

  async reorder(products: { id: string; position: number }[]) {
    await this.prisma.$transaction(
      products.map(({ id, position }) =>
        this.prisma.product.update({
          where: { id },
          data: { displayOrder: position },
        }),
      ),
    );
    return { updated: products.length };
  }

  async findAll(query: QueryProductDto) {
    const sanitizedQuery = { ...query, status: undefined } as QueryProductDto;
    const cacheKey = this.buildCacheKey(
      'cache:products:list',
      sanitizedQuery as Record<string, unknown>,
    );
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) {
      return cached as {
        data: unknown[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      };
    }

    const page = Number(sanitizedQuery.page) || 1;
    const limit = Number(sanitizedQuery.limit) || 10;
    const skip = (page - 1) * limit;

    const productWhere: Prisma.ProductWhereInput = {};

    let categoryIds: string[] | undefined;
    if (sanitizedQuery.categoryId) {
      categoryIds = await this.getCategoryAndDescendantIds(sanitizedQuery.categoryId);

      if (categoryIds.length === 0) {
        const response = {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
        await this.setCache(cacheKey, response);
        return response;
      }

      productWhere.categoryId = { in: categoryIds };
    }

    productWhere.status = product_status.active;

    if (sanitizedQuery.featured !== undefined) {
      productWhere.featured = sanitizedQuery.featured === 'true';
    }

    const sort = sanitizedQuery.sort ?? 'featured';
    const sortByPrice = sort === 'price_asc' || sort === 'price_desc';

    const searchText = sanitizedQuery.search?.trim();
    let searchResult: { ids: string[]; total: number } | null = null;
    if (
      searchText &&
      this.shouldUseFtsSearch(sanitizedQuery, sortByPrice)
    ) {
      searchResult = await this.searchProductIdsFts({
        search: searchText,
        categoryIds,
        featured:
          sanitizedQuery.featured !== undefined
            ? sanitizedQuery.featured === 'true'
            : undefined,
        page,
        limit,
      });

      if (searchResult.total === 0 || searchResult.ids.length === 0) {
        const response = {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
        await this.setCache(cacheKey, response);
        return response;
      }

      productWhere.id = { in: searchResult.ids };
    } else if (searchText) {
      productWhere.OR = [
        { name: { contains: searchText, mode: 'insensitive' } },
        { slug: { contains: searchText, mode: 'insensitive' } },
      ];
    }

    const { variantFilters, forceEmpty } = await this.buildVariantFilters(sanitizedQuery);

    if (forceEmpty) {
      const response = {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
      await this.setCache(cacheKey, response);
      return response;
    }

    if (sortByPrice) {
      const variantWhere: Prisma.ProductVariantWhereInput = {
        ...variantFilters,
      };

      if (Object.keys(productWhere).length > 0) {
        variantWhere.product = productWhere;
      }

      const [grouped, distinctProducts] = await Promise.all([
        this.prisma.productVariant.groupBy({
          by: ['productId'],
          where: variantWhere,
          _min: { price: true },
          _max: { price: true },
          orderBy:
            sort === 'price_asc'
              ? [{ _min: { price: 'asc' } }, { productId: 'asc' }]
              : [{ _max: { price: 'desc' } }, { productId: 'asc' }],
          skip,
          take: limit,
        }),
        this.prisma.productVariant.findMany({
          where: variantWhere,
          select: { productId: true },
          distinct: ['productId'],
        }),
      ]);

      const total = distinctProducts.length;

      const productIds = grouped.map((item) => item.productId);

      if (productIds.length === 0) {
        const response = {
          data: [],
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        };
        await this.setCache(cacheKey, response);
        return response;
      }

      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          variants: {
            where: variantFilters,
            include: { inventory: true },
          },
          images: true,
          brand: true,
        },
      });

      const orderMap = new Map(productIds.map((id, index) => [id, index]));
      const ordered = products
        .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
        .map((p) => this.addAvailability(p));

      const response = {
        data: ordered,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
      await this.setCache(cacheKey, response);
      return response;
    }

    if (Object.keys(variantFilters).length > 0) {
      productWhere.variants = { some: variantFilters };
    }

    const useRelevance = sort === 'relevance' && searchResult !== null;
    const pageSkip = searchResult ? 0 : skip;
    const pageLimit = searchResult ? searchResult.ids.length : limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        skip: pageSkip,
        take: pageLimit,
        include: {
          variants: {
            where: variantFilters,
            include: { inventory: true },
          },
          images: true,
          brand: true,
        },
        orderBy: useRelevance
          ? undefined
          : sort === 'newest'
            ? [{ createdAt: 'desc' }]
            : [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      searchResult
        ? Promise.resolve(searchResult.total)
        : this.prisma.product.count({ where: productWhere }),
    ]);

    const orderMap = useRelevance
      ? new Map(searchResult!.ids.map((id, index) => [id, index]))
      : null;
    const sorted = useRelevance
      ? data.sort(
          (a, b) => (orderMap!.get(a.id) ?? 0) - (orderMap!.get(b.id) ?? 0),
        )
      : data;
    const ordered = sorted.map((p) => this.addAvailability(p));

    const response = {
      data: ordered,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
    await this.setCache(cacheKey, response);
    return response;
  }

  async findOne(id: string, query?: QueryProductDto) {
    const cacheKey = this.buildCacheKey(
      `cache:products:detail:${id}`,
      (query ?? {}) as Record<string, unknown>,
    );
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) {
      return cached as Record<string, unknown>;
    }

    const base = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, categoryId: true, status: true },
    });

    if (!base || base.status !== product_status.active) {
      throw new NotFoundException('Product not found');
    }

    const { variantFilters } = await this.buildVariantFilters(query ?? ({} as QueryProductDto));

    const product = await this.prisma.product.findFirst({
      where: { id, status: product_status.active },
      include: {
        variants: {
          where: variantFilters,
          include: {
            inventory: true,
            facetValues: {
              include: { facetValue: { include: { facet: true } } },
            },
          },
        },
        images: true,
        category: true,
        brand: true,
        facetValues: {
          include: { facetValue: { include: { facet: true } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const result = this.addAvailability(await this.enrichWithPresaleRemaining(product));
    await this.setCache(cacheKey, result);
    return result;
  }

  async findBySlug(slug: string, query?: QueryProductDto) {
    const cacheKey = this.buildCacheKey(
      `cache:products:slug:${slug}`,
      (query ?? {}) as Record<string, unknown>,
    );
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) {
      return cached as Record<string, unknown>;
    }

    const base = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, status: true },
    });

    if (!base || base.status !== product_status.active) {
      throw new NotFoundException('Product not found');
    }

    const { variantFilters } = await this.buildVariantFilters(query ?? ({} as QueryProductDto));

    const product = await this.prisma.product.findFirst({
      where: { slug, status: product_status.active },
      include: {
        variants: {
          where: variantFilters,
          include: {
            inventory: true,
            facetValues: {
              include: { facetValue: { include: { facet: true } } },
            },
          },
        },
        images: true,
        category: true,
        brand: true,
        facetValues: {
          include: { facetValue: { include: { facet: true } } },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const result = this.addAvailability(await this.enrichWithPresaleRemaining(product));
    await this.setCache(cacheKey, result);
    return result;
  }

  private async enrichWithPresaleRemaining(product: any): Promise<any> {
    const presaleVariantIds: string[] = (product.variants ?? [])
      .filter((v: any) => v.presaleEnabled)
      .map((v: any) => v.id as string);

    if (!presaleVariantIds.length) {
      return product;
    }

    const counts = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        variantId: { in: presaleVariantIds },
        order: { status: 'presale' as any },
      },
      _sum: { quantity: true },
    });

    const soldByVariant = new Map(counts.map((c) => [c.variantId, c._sum.quantity ?? 0]));

    return {
      ...product,
      variants: (product.variants ?? []).map((v: any) => {
        if (!v.presaleEnabled) return v;
        const sold = soldByVariant.get(v.id) ?? 0;
        const presaleRemaining = v.presaleLimit !== null && v.presaleLimit !== undefined
          ? Math.max(0, v.presaleLimit - sold)
          : null;
        return { ...v, presaleRemaining };
      }),
    };
  }

  async update(id: string, dto: UpdateProductDto, context?: AuditContext) {
    const { categoryId, variants, brandId, facetValueIds, ...rest } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const before = await this.getProductAuditSnapshot(id, tx);

      const existing = await tx.product.findUnique({
        where: { id },
        select: { id: true, categoryId: true },
      });

      if (!existing) {
        throw new NotFoundException('Product not found');
      }

      const effectiveCategoryId = categoryId ?? existing.categoryId;

      const skuFacetInfo = await this.getSkuFacetInfo(tx, variants ?? []);
      const hasColorSource = !!skuFacetInfo.colorFacetId;

      const needsAutoSku =
        variants?.some((variant) => !variant.id && !variant.sku) ?? false;
      let skuContext:
        | { departmentCode: string; categoryCode: string; year: number; scope: string }
        | null = null;
      let baseSku: string | null = null;

      if (needsAutoSku) {
        const ensuredContext = await this.getSkuContext(effectiveCategoryId, tx);
        skuContext = ensuredContext;
        if (hasColorSource) {
          baseSku = await this.generateSkuBase(ensuredContext, tx);
        }
      }

      const data: Prisma.ProductUpdateInput = {
        ...rest,
      };

      if (categoryId) {
        data.category = { connect: { id: categoryId } };
      }

      if (brandId !== undefined) {
        data.brand = brandId ? { connect: { id: brandId } } : { disconnect: true };
      }

      const product = await tx.product.update({
        where: { id },
        data,
      });

      if (facetValueIds !== undefined) {
        await this.syncProductFacetValues(tx, id, facetValueIds);
      }

      if (variants?.length) {
        for (const variant of variants) {
          if (variant.id) {
            const existing = await tx.productVariant.findUnique({
              where: { id: variant.id },
              select: { id: true, productId: true, price: true, compareAtPrice: true },
            });

            if (!existing || existing.productId !== id) {
              throw new BadRequestException('Variant does not belong to product');
            }

            const {
              id: variantId,
              stockQuantity,
              facetValueIds: variantFacetValueIds,
              ...variantData
            } = variant;

            if (Object.keys(variantData).length > 0) {
              await tx.productVariant.update({
                where: { id: variantId },
                data: variantData,
              });
            }

            if (this.hasPriceUpdate(variant)) {
              const nextPrice = this.resolveNumericValue(
                variant.price,
                existing.price,
              );
              const nextCompare = this.resolveNumericValue(
                variant.compareAtPrice,
                existing.compareAtPrice,
              );

              if (
                this.isPriceChanged(existing.price, nextPrice) ||
                this.isPriceChanged(existing.compareAtPrice, nextCompare)
              ) {
                await this.recordPriceHistory(tx, {
                  variantId,
                  price: nextPrice ?? 0,
                  compareAtPrice: nextCompare,
                  context,
                });
              }
            }

            if (stockQuantity !== undefined) {
              await tx.inventory.upsert({
                where: { variantId },
                update: { stockQuantity },
                create: { variantId, stockQuantity },
              });
            }

            if (variantFacetValueIds !== undefined) {
              await this.syncVariantFacetValues(tx, variantId, variantFacetValueIds);
            }
          } else {
            if (variant.price === undefined || variant.stockQuantity === undefined) {
              throw new BadRequestException(
                'New variants require price and stockQuantity',
              );
            }

            let sku = variant.sku;

            if (!sku) {
              const ensuredContext =
                skuContext ??
                (skuContext = await this.getSkuContext(effectiveCategoryId, tx));

              if (hasColorSource) {
                if (!baseSku) {
                  baseSku = await this.generateSkuBase(ensuredContext, tx);
                }

                const colorValue = this.getFacetSkuValue(
                  variant.facetValueIds,
                  skuFacetInfo.colorFacetId,
                  skuFacetInfo.valueById,
                  12,
                );
                if (!colorValue) {
                  throw new BadRequestException(
                    'Cor is required for SKU generation. Provide the facetValue or set SKU manually.',
                  );
                }

                const sizeValue = this.getFacetSkuValue(
                  variant.facetValueIds,
                  skuFacetInfo.sizeFacetIds,
                  skuFacetInfo.valueById,
                  8,
                );
                sku = sizeValue ? `${baseSku}-${colorValue}-${sizeValue}` : `${baseSku}-${colorValue}`;
              } else {
                sku = await this.generateSkuBase(ensuredContext, tx);
              }
            }

            const createdVariant = await tx.productVariant.create({
              data: {
                productId: id,
                sku,
                title: variant.title,
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
              },
            });

            await this.recordPriceHistory(tx, {
              variantId: createdVariant.id,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice ?? null,
              context,
            });

            await tx.inventory.create({
              data: {
                variantId: createdVariant.id,
                stockQuantity: variant.stockQuantity,
              },
            });

            if (variant.facetValueIds?.length) {
              await this.syncVariantFacetValues(tx, createdVariant.id, variant.facetValueIds);
            }
          }
        }
      }

      const after = await this.getProductAuditSnapshot(id, tx);

      return { product, before, after };
    });

    await this.invalidateProductCache();

    await this.auditLog.log({
      action: 'update',
      entity: 'product',
      entityId: id,
      before: result.before,
      after: result.after,
      context,
    });

    return result.product;
  }

  async addImages(
    productId: string,
    files: Express.Multer.File[],
    variantId?: string,
    context?: AuditContext,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        throw new BadRequestException(
          `Ficheiro inválido: ${file.originalname}. Apenas JPEG, PNG, WebP e GIF são permitidos.`,
        );
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (variantId) {
      if (!isUUID(variantId)) {
        throw new BadRequestException('variantId must be a UUID');
      }

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true },
      });

      if (!variant || variant.productId !== productId) {
        throw new BadRequestException('Variant does not belong to product');
      }
    }

    const beforeImages = await this.prisma.productImage.findMany({
      where: { productId, ...(variantId ? { variantId } : {}) },
      orderBy: { position: 'asc' },
    });

    const positionBase =
      (
        await this.prisma.productImage.aggregate({
          where: { productId, ...(variantId ? { variantId } : {}) },
          _max: { position: true },
        })
      )._max.position ?? -1;

    const supabase = this.getSupabaseClient();
    const { bucket, isPublic, signedTtl } = this.getStorageSettings();

    const data = await Promise.all(
      files.map(async (file, index) => {
        const ext = extname(file.originalname).toLowerCase();
        const filename = `${randomUUID()}${ext}`;
        const folder = variantId ? `variant-${variantId}` : 'product';
        const path = `products/${productId}/${folder}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

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

        return {
          productId,
          variantId: variantId ?? null,
          url,
          altText: file.originalname,
          position: positionBase + index + 1,
        };
      }),
    );

    await this.prisma.productImage.createMany({ data });

    const afterImages = await this.prisma.productImage.findMany({
      where: { productId, ...(variantId ? { variantId } : {}) },
      orderBy: { position: 'asc' },
    });

    await this.auditLog.log({
      action: 'update',
      entity: 'product_image',
      entityId: productId,
      before: beforeImages,
      after: afterImages,
      context,
    });

    return afterImages;
  }

  async getPriceHistory(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.priceHistory.findMany({
      where: { variant: { productId } },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  async remove(id: string, context?: AuditContext) {
    const before = await this.getProductAuditSnapshot(id);
    if (!before) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { status: product_status.archived, featured: false },
    });

    await this.invalidateProductCache();

    const after = await this.getProductAuditSnapshot(id);

    await this.auditLog.log({
      action: 'archive',
      entity: 'product',
      entityId: id,
      before,
      after,
      context,
    });

    return product;
  }

  private hasPriceUpdate(variant: { price?: number; compareAtPrice?: number | null }) {
    return variant.price !== undefined || variant.compareAtPrice !== undefined;
  }

  private resolveNumericValue(
    incoming: number | Prisma.Decimal | null | undefined,
    fallback: number | Prisma.Decimal | null | undefined,
  ) {
    if (incoming === undefined) {
      return this.toNumber(fallback);
    }
    if (incoming === null) {
      return null;
    }
    return this.toNumber(incoming);
  }

  private toNumber(value: number | Prisma.Decimal | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }
    return value instanceof Prisma.Decimal ? value.toNumber() : value;
  }

  private isPriceChanged(
    current: number | Prisma.Decimal | null | undefined,
    next: number | null | undefined,
  ) {
    const currentValue = this.toNumber(current);
    if (currentValue === null && (next === null || next === undefined)) {
      return false;
    }
    return currentValue !== next;
  }

  private async recordPriceHistory(
    tx: Prisma.TransactionClient,
    input: {
      variantId: string;
      price: number;
      compareAtPrice: number | null;
      context?: AuditContext;
    },
  ) {
    await tx.priceHistory.create({
      data: {
        variantId: input.variantId,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
        actorId: input.context?.actorId ?? null,
        actorEmail: input.context?.actorEmail ?? null,
        actorRole: input.context?.actorRole ?? null,
      },
    });
  }

  /**
   * Grava os FacetValue de um produto (scope=product — gender, activity...).
   * Substitui o conjunto inteiro a cada chamada.
   */
  private async syncProductFacetValues(
    tx: Prisma.TransactionClient,
    productId: string,
    facetValueIds: string[],
  ) {
    await tx.productFacetValue.deleteMany({ where: { productId } });
    if (facetValueIds.length === 0) return;

    const values = await tx.facetValue.findMany({
      where: { id: { in: facetValueIds } },
      select: { id: true, facet: { select: { scope: true } } },
    });

    if (values.length !== facetValueIds.length) {
      throw new BadRequestException('facetValueIds contains unknown FacetValue id(s)');
    }
    if (values.some((v) => v.facet.scope !== 'product')) {
      throw new BadRequestException(
        'facetValueIds for a product must reference facets with scope=product',
      );
    }

    await tx.productFacetValue.createMany({
      data: facetValueIds.map((facetValueId) => ({ productId, facetValueId })),
    });
  }

  /** Mesma lógica de syncProductFacetValues, mas pra facetas scope=variant (color, size_*). */
  private async syncVariantFacetValues(
    tx: Prisma.TransactionClient,
    variantId: string,
    facetValueIds: string[],
  ) {
    await tx.variantFacetValue.deleteMany({ where: { variantId } });
    if (facetValueIds.length === 0) return;

    const values = await tx.facetValue.findMany({
      where: { id: { in: facetValueIds } },
      select: { id: true, facet: { select: { scope: true } } },
    });

    if (values.length !== facetValueIds.length) {
      throw new BadRequestException('facetValueIds contains unknown FacetValue id(s)');
    }
    if (values.some((v) => v.facet.scope !== 'variant')) {
      throw new BadRequestException(
        'facetValueIds for a variant must reference facets with scope=variant',
      );
    }

    await tx.variantFacetValue.createMany({
      data: facetValueIds.map((facetValueId) => ({ variantId, facetValueId })),
    });
  }

  private buildSectionMeta(
    section: string,
    data: unknown[],
    extras: Record<string, unknown> = {},
  ) {
    const minProducts = 4;
    return {
      total: data.length,
      visible: data.length >= minProducts,
      section,
      ...extras,
    };
  }

  // ─── Destaques da Semana ────────────────────────────────────────────────────

  async findHighlights(query: QuerySectionDto) {
    const limit = query.limit ?? 12;
    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;
    const cacheKey = this.buildCacheKey('cache:sections:highlights', {
      limit,
      categoryId: query.categoryId,
    });
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const categoryScope = categoryIds ? { categoryId: { in: categoryIds } } : {};

    const featured = await this.prisma.product.findMany({
      where: {
        status: product_status.active,
        featured: true,
        featuredUntil: { gte: now },
        variants: { some: { isActive: true } },
        ...categoryScope,
      },
      include: {
        variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
        images: { orderBy: { position: 'asc' } },
        category: true,
      },
      orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    let data: any[] = featured.map((p) => this.addAvailability(p));

    if (data.length < limit) {
      const excludeIds = data.map((p) => p.id);
      const fill = await this.prisma.product.findMany({
        where: {
          status: product_status.active,
          id: { notIn: excludeIds },
          variants: { some: { isActive: true } },
          ...categoryScope,
        },
        include: {
          variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
          images: { orderBy: { position: 'asc' } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit - data.length,
      });
      data = [...data, ...fill.map((p) => this.addAvailability(p))];
    }

    const response = { data, meta: this.buildSectionMeta('highlights', data) };
    await this.setCache(cacheKey, response);
    return response;
  }

  // ─── Acabaram de Chegar ─────────────────────────────────────────────────────

  async findNewArrivals(query: QuerySectionDto) {
    const limit = query.limit ?? 12;
    const days = query.days ?? Number(this.configService.get('NEW_ARRIVALS_WINDOW_DAYS') ?? 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;

    const cacheKey = this.buildCacheKey('cache:sections:new-arrivals', {
      limit,
      days,
      categoryId: query.categoryId,
    });
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const raw = await this.prisma.product.findMany({
      where: {
        status: product_status.active,
        createdAt: { gte: since },
        variants: { some: { isActive: true } },
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      },
      include: {
        variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
        images: { orderBy: { position: 'asc' } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const data = raw.map((p) => this.addAvailability(p));

    const response = {
      data,
      meta: this.buildSectionMeta('new-arrivals', data, { windowDays: days }),
    };
    await this.setCache(cacheKey, response);
    return response;
  }

  // ─── Mais Vendidos ──────────────────────────────────────────────────────────

  async findBestSellers(query: QuerySectionDto) {
    const limit = query.limit ?? 12;
    const window = query.window ?? '30d';
    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;
    const cacheKey = this.buildCacheKey('cache:sections:best-sellers', {
      limit,
      window,
      categoryId: query.categoryId,
    });
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const orderByField =
      window === '7d' ? 'unitsSold7d' :
      window === 'all' ? 'unitsSoldAll' :
      'unitsSold30d';

    const categoryScope = categoryIds ? { categoryId: { in: categoryIds } } : {};

    const ranked = await this.prisma.productRanking.findMany({
      where: {
        product: { status: product_status.active, variants: { some: { isActive: true } }, ...categoryScope },
      },
      include: {
        product: {
          include: {
            variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
            images: { orderBy: { position: 'asc' } },
            category: true,
          },
        },
      },
      orderBy: [{ [orderByField]: 'desc' }, { score: 'desc' }],
      take: limit,
    });

    let data: any[] = ranked.map((r) => this.addAvailability(r.product));
    let fallback = false;

    if (data.length === 0) {
      fallback = true;
      const fallbackRaw = await this.prisma.product.findMany({
        where: { status: product_status.active, variants: { some: { isActive: true } }, ...categoryScope },
        include: {
          variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
          images: { orderBy: { position: 'asc' } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      data = fallbackRaw.map((p) => this.addAvailability(p));
    }

    const rankingUpdatedAt = ranked[0]?.updatedAt ?? null;
    const response = {
      data,
      meta: this.buildSectionMeta('best-sellers', data, { window, fallback, rankingUpdatedAt }),
    };
    await this.setCache(cacheKey, response);
    return response;
  }

  // ─── Melhores Preços ────────────────────────────────────────────────────────

  async findBestPrices(query: QuerySectionDto) {
    const limit = query.limit ?? 12;
    const minDiscount = query.minDiscount ?? 10;
    const categoryIds = query.categoryId
      ? await this.getCategoryAndDescendantIds(query.categoryId)
      : undefined;
    const cacheKey = this.buildCacheKey('cache:sections:best-prices', {
      limit,
      minDiscount,
      categoryId: query.categoryId,
    });
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const toNum = (v: unknown): number =>
      v instanceof Prisma.Decimal ? v.toNumber() : Number(v);

    const now = new Date();

    const activePromotions = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
        targets: { some: { targetType: { in: ['product', 'category'] } } },
      },
      include: { targets: true },
    });

    const promoExpandedCategories = new Map<string, Set<string>>();
    for (const promo of activePromotions) {
      const cats = new Set<string>();
      for (const t of promo.targets) {
        if (t.targetType === 'category' && t.categoryId) {
          const ids = await this.getCategoryAndDescendantIds(t.categoryId);
          ids.forEach((id) => cats.add(id));
        }
      }
      if (cats.size > 0) promoExpandedCategories.set(promo.id, cats);
    }

    const products = await this.prisma.product.findMany({
      where: {
        status: product_status.active,
        variants: { some: { isActive: true } },
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      },
      include: {
        variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
        images: { orderBy: { position: 'asc' } },
        category: true,
      },
    });

    type Priced = (typeof products)[0] & { pricing: { originalPrice: number; discountedPrice: number; discountPercent: number; discountSource: 'variant' | 'promotion' } };
    const priced: Priced[] = [];

    for (const product of products) {
      const variant = product.variants[0];
      if (!variant) continue;

      const price = toNum(variant.price);
      const compareAt = variant.compareAtPrice ? toNum(variant.compareAtPrice) : null;

      let discountPercent = 0;
      let discountSource: 'variant' | 'promotion' = 'variant';

      if (compareAt && compareAt > price) {
        discountPercent = Math.round(((compareAt - price) / compareAt) * 100);
        discountSource = 'variant';
      }

      for (const promo of activePromotions) {
        let matches = false;
        for (const t of promo.targets) {
          if (t.targetType === 'product' && t.productId === product.id) { matches = true; break; }
          if (t.targetType === 'category') {
            const cats = promoExpandedCategories.get(promo.id);
            if (cats?.has(product.categoryId)) { matches = true; break; }
          }
        }
        if (!matches) continue;

        const promoValue = toNum(promo.value);
        const pd = promo.type === 'percent'
          ? promoValue
          : price > 0 ? Math.round((promoValue / price) * 100) : 0;

        if (pd > discountPercent) {
          discountPercent = pd;
          discountSource = 'promotion';
        }
      }

      if (discountPercent < minDiscount) continue;

      const originalPrice = compareAt && discountSource === 'variant' ? compareAt : price;
      const discountedPrice =
        discountSource === 'variant'
          ? price
          : Math.max(0, price - (activePromotions.find((p) => {
              for (const t of p.targets) {
                if (t.targetType === 'product' && t.productId === product.id) return true;
                if (t.targetType === 'category') {
                  const cats = promoExpandedCategories.get(p.id);
                  if (cats?.has(product.categoryId)) return true;
                }
              }
              return false;
            })?.type === 'fixed'
              ? toNum(activePromotions.find((p) => {
                  for (const t of p.targets) {
                    if (t.targetType === 'product' && t.productId === product.id) return true;
                    if (t.targetType === 'category') {
                      const cats = promoExpandedCategories.get(p.id);
                      if (cats?.has(product.categoryId)) return true;
                    }
                  }
                  return false;
                })?.value ?? 0)
              : price * (discountPercent / 100)));

      priced.push({
        ...this.addAvailability(product),
        pricing: {
          originalPrice: Math.round(originalPrice * 100) / 100,
          discountedPrice: Math.round(discountedPrice * 100) / 100,
          discountPercent,
          discountSource,
        },
      });
    }

    priced.sort((a, b) => b.pricing.discountPercent - a.pricing.discountPercent);
    const data = priced.slice(0, limit);

    const response = {
      data,
      meta: this.buildSectionMeta('best-prices', data, { minDiscount }),
    };
    await this.setCache(cacheKey, response);
    return response;
  }

  async findOffers(query: QueryOffersDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const cacheKey = this.buildCacheKey(
      'cache:products:offers',
      query as Record<string, unknown>,
    );
    const cached = await this.getCache<unknown>(cacheKey);
    if (cached) return cached;

    const now = new Date();

    const promotionWhere: Prisma.PromotionWhereInput = {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
      targets: { some: { targetType: { in: ['product', 'category'] } } },
    };

    if (query.type === 'daily') {
      promotionWhere.label = 'oferta_do_dia';
    }

    const promotions = await this.prisma.promotion.findMany({
      where: promotionWhere,
      include: { targets: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    if (promotions.length === 0) {
      const response = { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      await this.setCache(cacheKey, response);
      return response;
    }

    // Per-promotion expanded category sets for accurate matching
    const promoExpandedCategories = new Map<string, Set<string>>();
    const allExpandedCategoryIds = new Set<string>();
    const directProductIds = new Set<string>();

    for (const promo of promotions) {
      const promoCatIds = new Set<string>();
      for (const target of promo.targets) {
        if (target.targetType === 'product' && target.productId) {
          directProductIds.add(target.productId);
        } else if (target.targetType === 'category' && target.categoryId) {
          const expanded = await this.getCategoryAndDescendantIds(target.categoryId);
          expanded.forEach((id) => {
            promoCatIds.add(id);
            allExpandedCategoryIds.add(id);
          });
        }
      }
      if (promoCatIds.size > 0) {
        promoExpandedCategories.set(promo.id, promoCatIds);
      }
    }

    const orConditions: Prisma.ProductWhereInput[] = [];
    if (directProductIds.size > 0) {
      orConditions.push({ id: { in: Array.from(directProductIds) } });
    }
    if (allExpandedCategoryIds.size > 0) {
      orConditions.push({ categoryId: { in: Array.from(allExpandedCategoryIds) } });
    }

    if (orConditions.length === 0) {
      const response = { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      await this.setCache(cacheKey, response);
      return response;
    }

    const productWhere: Prisma.ProductWhereInput = {
      status: product_status.active,
      OR: orConditions,
      variants: { some: { isActive: true } },
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        skip,
        take: limit,
        include: {
          variants: { where: { isActive: true }, orderBy: { price: 'asc' }, include: { inventory: true } },
          images: { orderBy: { position: 'asc' } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: productWhere }),
    ]);

    const toNumber = (v: unknown): number =>
      v instanceof Prisma.Decimal ? v.toNumber() : Number(v);

    const data = products.map((product) => {
      let bestPromo: (typeof promotions)[0] | null = null;
      let bestPriority = -Infinity;
      let bestDiscount = -Infinity;

      const cheapestVariantPrice = product.variants[0]
        ? toNumber(product.variants[0].price)
        : 0;

      for (const promo of promotions) {
        let matches = false;
        for (const target of promo.targets) {
          if (target.targetType === 'product' && target.productId === product.id) {
            matches = true;
            break;
          }
          if (target.targetType === 'category') {
            const cats = promoExpandedCategories.get(promo.id);
            if (cats?.has(product.categoryId)) {
              matches = true;
              break;
            }
          }
        }

        if (!matches) continue;

        const promoValue = toNumber(promo.value);
        const discountAmount =
          promo.type === 'percent'
            ? cheapestVariantPrice * (promoValue / 100)
            : promoValue;

        if (
          promo.priority > bestPriority ||
          (promo.priority === bestPriority && discountAmount > bestDiscount)
        ) {
          bestPriority = promo.priority;
          bestDiscount = discountAmount;
          bestPromo = promo;
        }
      }

      if (!bestPromo) return null;

      const originalPrice = cheapestVariantPrice;
      const promoValue = toNumber(bestPromo.value);
      let discountedPrice: number;
      let discountPercent: number;

      if (bestPromo.type === 'percent') {
        discountedPrice = Math.max(0, originalPrice * (1 - promoValue / 100));
        discountPercent = promoValue;
      } else {
        discountedPrice = Math.max(0, originalPrice - promoValue);
        discountPercent =
          originalPrice > 0 ? Math.round((promoValue / originalPrice) * 100) : 0;
      }

      const withAvail = this.addAvailability(product);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        featured: product.featured,
        status: product.status,
        category: product.category,
        images: product.images,
        variants: withAvail.variants,
        offer: {
          promotionId: bestPromo.id,
          label: bestPromo.label,
          type: bestPromo.type,
          discountValue: promoValue,
          endsAt: bestPromo.endsAt,
          originalPrice: Math.round(originalPrice * 100) / 100,
          discountedPrice: Math.round(discountedPrice * 100) / 100,
          discountPercent,
        },
      };
    }).filter(Boolean);

    const response = {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
    await this.setCache(cacheKey, response);
    return response;
  }

  private shouldUseFtsSearch(query: QueryProductDto, sortByPrice: boolean) {
    if (!query.search?.trim()) {
      return false;
    }
    if (sortByPrice) {
      return false;
    }
    const mode = this.configService.get<string>('PRODUCT_SEARCH_MODE') ?? 'basic';
    if (mode.toLowerCase() !== 'fts') {
      return false;
    }
    return !this.hasAdvancedSearchFilters(query);
  }

  private hasAdvancedSearchFilters(query: QueryProductDto) {
    return Boolean(
      query.facets ||
        query.brand ||
        query.minPrice !== undefined ||
        query.maxPrice !== undefined ||
        query.inStock === 'true',
    );
  }

  private getSearchLanguage() {
    const raw = this.configService.get<string>('PRODUCT_SEARCH_LANGUAGE');
    if (!raw) {
      return 'simple';
    }
    const normalized = raw.trim().toLowerCase();
    const allowed = new Set([
      'simple',
      'english',
      'portuguese',
      'spanish',
      'french',
      'german',
      'italian',
    ]);
    return allowed.has(normalized) ? normalized : 'simple';
  }

  private async searchProductIdsFts(input: {
    search: string;
    categoryIds?: string[];
    featured?: boolean;
    page: number;
    limit: number;
  }) {
    const search = input.search.trim();
    if (!search) {
      return { ids: [], total: 0 };
    }

    const language = this.getSearchLanguage();
    const offset = (input.page - 1) * input.limit;
    const categoryFilter =
      input.categoryIds && input.categoryIds.length > 0
        ? Prisma.sql`AND p.category_id IN (${Prisma.join(input.categoryIds)})`
        : Prisma.sql``;
    const featuredFilter =
      input.featured !== undefined
        ? Prisma.sql`AND p.featured = ${input.featured}`
        : Prisma.sql``;
    const activeVariantFilter = Prisma.sql`
      AND EXISTS (
        SELECT 1 FROM product_variants v2
        WHERE v2.product_id = p.id AND v2.is_active = true
      )
    `;

    const languageSql = Prisma.raw(language);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH q AS (
        SELECT websearch_to_tsquery(${languageSql}, ${search}) AS query
      )
      SELECT p.id
      FROM products p
      LEFT JOIN product_variants v
        ON v.product_id = p.id AND v.is_active = true
      CROSS JOIN q
      WHERE p.status = 'active'
        ${categoryFilter}
        ${featuredFilter}
        ${activeVariantFilter}
        AND (p.search_vector @@ q.query OR v.search_vector @@ q.query)
      GROUP BY p.id
      ORDER BY
        GREATEST(
          ts_rank_cd(p.search_vector, q.query),
          COALESCE(MAX(ts_rank_cd(v.search_vector, q.query)), 0)
        ) DESC,
        p.id
      LIMIT ${input.limit}
      OFFSET ${offset};
    `);

    const totalRows = await this.prisma.$queryRaw<Array<{ total: unknown }>>(Prisma.sql`
      WITH q AS (
        SELECT websearch_to_tsquery(${languageSql}, ${search}) AS query
      )
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN product_variants v
        ON v.product_id = p.id AND v.is_active = true
      CROSS JOIN q
      WHERE p.status = 'active'
        ${categoryFilter}
        ${featuredFilter}
        ${activeVariantFilter}
        AND (p.search_vector @@ q.query OR v.search_vector @@ q.query);
    `);

    const totalRaw = totalRows[0]?.total ?? 0;
    const total =
      typeof totalRaw === 'bigint'
        ? Number(totalRaw)
        : typeof totalRaw === 'string'
          ? Number(totalRaw)
          : Number(totalRaw);

    return { ids: rows.map((row) => row.id), total };
  }

  async updatePresaleSettings(
    variantId: string,
    dto: import('./dto/update-presale-settings.dto').UpdatePresaleSettingsDto,
    context?: AuditContext,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (dto.presaleEnabled) {
      const stock = (variant.inventory?.stockQuantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
      if (stock > 0) {
        throw new BadRequestException(
          'Cannot enable presale while variant has stock available. Set stock to 0 first.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.productVariant.update({
        where: { id: variantId },
        data: {
          presaleEnabled: dto.presaleEnabled,
          presalePrice: dto.presalePrice !== undefined
            ? new Prisma.Decimal(dto.presalePrice)
            : dto.presaleEnabled ? undefined : null,
          presaleLimit: dto.presaleLimit ?? (dto.presaleEnabled ? undefined : null),
          expectedAvailableAt: dto.expectedAvailableAt
            ? new Date(dto.expectedAvailableAt)
            : dto.presaleEnabled ? undefined : null,
        },
      });
    });

    await this.invalidateProductCache();
    return updated;
  }
}
