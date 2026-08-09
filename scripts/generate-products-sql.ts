/**
 * Gera SQL puro (INSERT) de produtos+variantes+facetas a partir de
 * STORAGES_MANIFEST.json — alternativa ao scripts/seed-products-from-storages.ts
 * pra quando a conexão Prisma/pg estiver instável. Não escreve no banco, só gera
 * o arquivo .sql pra você rodar com `psql` (mesmo fluxo já usado nos outros seeds).
 *
 * NÃO inclui imagem — upload de arquivo binário não dá pra fazer em SQL puro.
 * product_images fica vazio; isso é tratado depois, separado (ver
 * PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md).
 *
 * IDs são determinísticos (derivados do hash de conteúdo da imagem via sha256),
 * não gen_random_uuid() — assim rodar o script de novo sempre gera os MESMOS IDs,
 * e ON CONFLICT DO NOTHING funciona de forma consistente entre re-execuções
 * (evita produto pulado por conflito de slug mas variante tentando referenciar
 * um product_id que nunca foi inserido).
 *
 * Uso:
 *   npx ts-node -T scripts/generate-products-sql.ts                  → todos os 530
 *   SEED_SAMPLE_PER_GROUP=2 npx ts-node -T scripts/generate-products-sql.ts → amostra (~36)
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ManifestEntry {
  file: string;
  contentHash: string;
  isDuplicateOf: string | null;
  brand: string | null;
  nameGuess: string;
  categorySlug: string | null;
  subcategorySlug: string | null;
  gender: 'men' | 'women' | 'kids' | 'unisex' | null;
  ageGroup: 'child' | 'preschool' | null;
  colorFacetGuess: string | null;
}

const MANIFEST_PATH = join(__dirname, '..', 'STORAGES_MANIFEST.json');
const OUT_PATH = join(__dirname, '..', 'SQL_PRODUCTS_SEED.sql');
const PLACEHOLDER_PRICE = '99.99';

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  bytes[12] = '4';
  bytes[16] = '89ab'[parseInt(bytes[16], 16) % 4];
  const hex = bytes.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function brandSlug(brand: string | null): string {
  return slugify(brand ?? '');
}

function pickSizeFacetKey(entry: ManifestEntry): string | null {
  if (entry.categorySlug === 'sneakers' || entry.categorySlug === 'shoes') {
    if (entry.gender === 'women') return 'size_women';
    if (entry.gender === 'kids') return 'size_kids';
    return 'size_men';
  }
  if (entry.categorySlug === 'apparel') return 'size_apparel';
  return null;
}

// Grades fixas — mesmas do SQL_CATALOG_FACETS_SEED.sql (value, sort_order).
const SIZE_GRIDS: Record<string, string[]> = {
  size_men: ['39', '40', '40.5', '41', '42', '42.5', '43', '44', '44.5', '45', '45.5', '46', '47', '47.5'],
  size_women: ['35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '40', '40.5', '41', '42'],
  size_kids: ['16', '17', '18', '18.5', '19', '19.5', '20', '20.5', '21', '22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26'],
  size_apparel: ['xs', 's', 'm', 'l', 'xl', 'xxl'],
};

function main() {
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const allUnique = manifest.filter((e) => !e.isDuplicateOf);

  let unique = allUnique;
  const sampleEnv = Number(process.env.SEED_SAMPLE_PER_GROUP);
  if (Number.isFinite(sampleEnv) && sampleEnv > 0) {
    const groups = new Map<string, ManifestEntry[]>();
    for (const e of allUnique) {
      const key = `${e.categorySlug ?? ''}|${e.subcategorySlug ?? ''}|${e.gender ?? ''}|${e.ageGroup ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    unique = [...groups.values()].flatMap((g) => g.slice(0, sampleEnv));
  }

  const usedSlugs = new Set<string>();
  const lines: string[] = [
    '-- Gerado por scripts/generate-products-sql.ts a partir de STORAGES_MANIFEST.json',
    '-- Dado de desenvolvimento/staging (ver PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md).',
    '-- SEM imagem — product_images fica vazio, tratado à parte.',
    '-- Idempotente (IDs determinísticos + ON CONFLICT DO NOTHING).',
    '-- Pré-requisito: SQL_FULL_SCHEMA.sql + SQL_CATEGORIES_SEED.sql + SQL_CATALOG_FACETS_SEED.sql + SQL_BRANDS_SEED.sql + SQL_BRANDS_SEED_EXTRA.sql já aplicados.',
    '',
    'BEGIN;',
    '',
  ];

  let skippedNoBrand = 0;
  let skippedNoCategory = 0;
  let productCount = 0;
  let variantCount = 0;

  for (const entry of unique) {
    const bSlug = brandSlug(entry.brand);
    if (!bSlug) {
      skippedNoBrand++;
      continue;
    }
    const targetCategorySlug = entry.subcategorySlug ?? entry.categorySlug;
    if (!targetCategorySlug) {
      skippedNoCategory++;
      continue;
    }

    let baseSlug = slugify(`${entry.brand}-${entry.nameGuess}`);
    if (!baseSlug) baseSlug = slugify(entry.contentHash.slice(0, 12));
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const productId = deterministicUuid(`product:${entry.contentHash}`);
    const nameStartsWithBrand = entry.nameGuess.toLowerCase().startsWith((entry.brand ?? '').toLowerCase());
    const description = nameStartsWithBrand ? `${entry.nameGuess}.` : `${entry.brand} ${entry.nameGuess}.`;

    lines.push(`-- ${entry.file}`);
    lines.push(
      `INSERT INTO products (id, category_id, brand_id, name, slug, description, status, featured, created_at, updated_at) VALUES (` +
        `'${productId}', ` +
        `(SELECT id FROM categories WHERE slug = '${esc(targetCategorySlug)}'), ` +
        `(SELECT id FROM brands WHERE slug = '${esc(bSlug)}'), ` +
        `'${esc(entry.nameGuess)}', '${esc(slug)}', '${esc(description)}', 'active', false, now(), now()` +
        `) ON CONFLICT (slug) DO NOTHING;`,
    );

    if (entry.gender) {
      lines.push(
        `INSERT INTO product_facet_values (product_id, facet_value_id) SELECT '${productId}', fv.id FROM facet_values fv JOIN facets f ON f.id = fv.facet_id WHERE f.key = 'gender' AND fv.value = '${esc(entry.gender)}' ON CONFLICT DO NOTHING;`,
      );
    }
    if (entry.ageGroup) {
      lines.push(
        `INSERT INTO product_facet_values (product_id, facet_value_id) SELECT '${productId}', fv.id FROM facet_values fv JOIN facets f ON f.id = fv.facet_id WHERE f.key = 'age_group' AND fv.value = '${esc(entry.ageGroup)}' ON CONFLICT DO NOTHING;`,
      );
    }

    const sizeFacetKey = pickSizeFacetKey(entry);
    const sizeGrid = sizeFacetKey ? SIZE_GRIDS[sizeFacetKey] : null;
    const dimension = sizeGrid && sizeGrid.length ? sizeGrid : [null];
    const contentHash8 = entry.contentHash.slice(0, 8).toUpperCase();

    for (const sizeValue of dimension) {
      const sizeSuffix = sizeValue ? sizeValue.toUpperCase().replace(/\./g, '') : 'STD';
      const sku = `DEV-${contentHash8}-${sizeSuffix}`;
      const variantId = deterministicUuid(`variant:${entry.contentHash}:${sizeSuffix}`);

      lines.push(
        `INSERT INTO product_variants (id, product_id, sku, price, is_active, created_at, updated_at) VALUES ('${variantId}', '${productId}', '${esc(sku)}', ${PLACEHOLDER_PRICE}, true, now(), now()) ON CONFLICT (sku) DO NOTHING;`,
      );
      lines.push(
        `INSERT INTO inventory (id, variant_id, stock_quantity, reserved_quantity, updated_at) SELECT gen_random_uuid(), '${variantId}', 0, 0, now() WHERE EXISTS (SELECT 1 FROM product_variants WHERE id = '${variantId}') ON CONFLICT (variant_id) DO NOTHING;`,
      );

      if (entry.colorFacetGuess) {
        lines.push(
          `INSERT INTO variant_facet_values (variant_id, facet_value_id) SELECT '${variantId}', fv.id FROM facet_values fv JOIN facets f ON f.id = fv.facet_id WHERE f.key = 'color' AND fv.value = '${esc(entry.colorFacetGuess)}' ON CONFLICT DO NOTHING;`,
        );
      }
      if (sizeFacetKey && sizeValue) {
        lines.push(
          `INSERT INTO variant_facet_values (variant_id, facet_value_id) SELECT '${variantId}', fv.id FROM facet_values fv JOIN facets f ON f.id = fv.facet_id WHERE f.key = '${esc(sizeFacetKey)}' AND fv.value = '${esc(sizeValue)}' ON CONFLICT DO NOTHING;`,
        );
      }
      variantCount++;
    }

    lines.push('');
    productCount++;
  }

  lines.push('COMMIT;');

  writeFileSync(OUT_PATH, lines.join('\n'));

  console.log(`Produtos: ${productCount} | Variantes: ${variantCount}`);
  console.log(`Pulados (marca não resolvida): ${skippedNoBrand} | Pulados (categoria não resolvida): ${skippedNoCategory}`);
  console.log(`Arquivo gerado: ${OUT_PATH}`);
}

main();
