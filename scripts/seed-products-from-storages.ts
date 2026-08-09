/**
 * Insere produtos+variantes+facetas+imagem a partir de STORAGES_MANIFEST.json
 * (gerado por scripts/organize-storages.ts). Dado de desenvolvimento/staging —
 * ver PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md seção 8 pelas decisões confirmadas
 * (preço placeholder 99.99, status=active, grade de tamanho completa, estoque 0,
 * descrição = template neutro, SKU = "DEV-{hash8}-{tamanho}" pra ficar fácil de
 * identificar e limpar antes de produção).
 *
 * Pré-requisitos no banco de destino (rodar antes, na ordem):
 *   1. SQL_FULL_SCHEMA.sql
 *   2. SQL_CATEGORIES_SEED.sql
 *   3. SQL_CATALOG_FACETS_SEED.sql (já com o bloco size_apparel)
 *   4. SQL_BRANDS_SEED.sql + SQL_BRANDS_SEED_EXTRA.sql
 *
 * Uso: npx ts-node -T -O '{"module":"commonjs"}' -r tsconfig-paths/register scripts/seed-products-from-storages.ts
 *
 * Idempotência: SKU é derivado do hash de conteúdo da imagem, então rodar de novo
 * tenta recriar os mesmos produtos — o `create()` vai falhar em `slug`/`sku` únicos
 * já existentes, e isso é reportado como erro por item (não trava o restante).
 *
 * Trava de segurança: o upload de imagem só roda se a env var ALLOW_IMAGE_UPLOAD=1
 * estiver explicitamente setada. Sem isso, o script cria produto/variante/faceta
 * normalmente mas PULA o upload (fica reportado como 'image_upload_skipped'). Isso
 * existe porque o ConfigModule carrega o .env do projeto (com credenciais reais do
 * Supabase) independente do DATABASE_URL apontar pra um banco local de teste — sem
 * a trava, testar localmente tentaria subir imagem pro storage de produção de verdade.
 *
 * SEED_SAMPLE_PER_GROUP=N (opcional, recomendado pro teste): em vez do lote inteiro,
 * pega só os primeiros N itens de cada combinação categoria+subcategoria+gênero+idade
 * — cobertura de todo tipo de dado com pouca quantidade. Ex.: SEED_SAMPLE_PER_GROUP=2
 * pega ~36 itens cobrindo os 21 tipos distintos hoje no manifesto, em vez dos 530.
 *
 * SEED_LIMIT=N (opcional): corta pros primeiros N itens depois da amostragem (ou do
 * lote inteiro, se SEED_SAMPLE_PER_GROUP não for usado). Útil pra um teste ainda menor.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { product_status } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ProductsModule } from '../src/modules/products/products.module';
import { ProductsService } from '../src/modules/products/products.service';
import { PrismaService } from '../src/database/prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProductsModule],
})
class SeedBootstrapModule {}

interface ManifestEntry {
  file: string;
  folder: string;
  filenameRaw: string;
  contentHash: string;
  isDuplicateOf: string | null;
  brand: string | null;
  isCollab: boolean;
  collaborators: string[];
  nameGuess: string;
  categorySlug: string | null;
  subcategorySlug: string | null;
  categoryConfidence: string;
  gender: 'men' | 'women' | 'kids' | 'unisex' | null;
  genderConfidence: string;
  ageGroup: 'child' | 'preschool' | null;
  colorFacetGuess: string | null;
  needsReview: boolean;
  reviewReasons: string[];
}

const MANIFEST_PATH = join(__dirname, '..', 'STORAGES_MANIFEST.json');
const STORAGES_ROOT = join(__dirname, '..', 'STORAGES');
const REPORT_PATH = join(__dirname, '..', 'SEED_PRODUCTS_REPORT.json');
const PLACEHOLDER_PRICE = 99.99;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickSizeFacetKey(entry: ManifestEntry): string | null {
  if (entry.categorySlug === 'sneakers' || entry.categorySlug === 'shoes') {
    if (entry.gender === 'women') return 'size_women';
    if (entry.gender === 'kids') return 'size_kids';
    return 'size_men';
  }
  if (entry.categorySlug === 'apparel') {
    return 'size_apparel';
  }
  return null;
}

async function main() {
  const app = await NestFactory.createApplicationContext(SeedBootstrapModule, {
    logger: ['error', 'warn'],
  });
  const productsService = app.get(ProductsService);
  const prisma = app.get(PrismaService);

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const facets = await prisma.facet.findMany({
    select: {
      id: true,
      key: true,
      values: { select: { id: true, value: true, sortOrder: true } },
    },
  });
  const facetByKey = new Map(facets.map((f) => [f.key, f]));

  function findFacetValueId(facetKey: string, value: string): string | undefined {
    return facetByKey.get(facetKey)?.values.find((v) => v.value === value)?.id;
  }

  const manifest: ManifestEntry[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const allUnique = manifest.filter((e) => !e.isDuplicateOf);

  let unique = allUnique;

  const sampleEnv = Number(process.env.SEED_SAMPLE_PER_GROUP);
  if (Number.isFinite(sampleEnv) && sampleEnv > 0) {
    // Amostra representativa: pelo menos N itens por combinação de
    // categoria+subcategoria+gênero+idade, em vez do lote inteiro — pra ter cobertura
    // de todo tipo de dado com pouca quantidade (ver PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md).
    const groups = new Map<string, ManifestEntry[]>();
    for (const e of allUnique) {
      const key = `${e.categorySlug ?? ''}|${e.subcategorySlug ?? ''}|${e.gender ?? ''}|${e.ageGroup ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    unique = [...groups.values()].flatMap((g) => g.slice(0, sampleEnv));
    console.log(
      `SEED_SAMPLE_PER_GROUP=${sampleEnv} ativo: ${groups.size} tipos distintos (categoria+subcategoria+gênero+idade), ${unique.length} itens selecionados de ${allUnique.length}.`,
    );
  }

  const limitEnv = Number(process.env.SEED_LIMIT);
  if (Number.isFinite(limitEnv) && limitEnv > 0) {
    unique = unique.slice(0, limitEnv);
    console.log(`SEED_LIMIT ativo: cortando pra ${unique.length} itens.`);
  }

  const usedSlugs = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let created = 0;
  let imagesUploaded = 0;
  let imageFailures = 0;
  let imagesSkippedByGuard = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  console.log(`Processando ${unique.length} produtos únicos... (ALLOW_IMAGE_UPLOAD=${process.env.ALLOW_IMAGE_UPLOAD ?? '(unset, upload será pulado)'})`);

  for (const entry of unique) {
    processed++;
    if (processed % 25 === 0) {
      console.log(`  ${processed}/${unique.length} processados (${created} criados, ${skipped} pulados, ${errors} erros)`);
    }
    const brandSlug = slugify(entry.brand ?? '');
    const brandId = brandBySlug.get(brandSlug);
    if (!brandId) {
      report.push({ file: entry.file, status: 'skipped', reason: `brand not found: ${entry.brand}` });
      skipped++;
      continue;
    }

    const targetCategorySlug = entry.subcategorySlug ?? entry.categorySlug;
    const category = targetCategorySlug ? categoryBySlug.get(targetCategorySlug) : undefined;
    if (!category) {
      report.push({ file: entry.file, status: 'skipped', reason: `category not found: ${targetCategorySlug}` });
      skipped++;
      continue;
    }

    let baseSlug = slugify(`${entry.brand}-${entry.nameGuess}`);
    if (!baseSlug) baseSlug = slugify(entry.contentHash.slice(0, 12));
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${n++}`;
    }
    usedSlugs.add(slug);

    const productFacetValueIds: string[] = [];
    const genderFvId = entry.gender ? findFacetValueId('gender', entry.gender) : undefined;
    if (genderFvId) productFacetValueIds.push(genderFvId);
    const ageFvId = entry.ageGroup ? findFacetValueId('age_group', entry.ageGroup) : undefined;
    if (ageFvId) productFacetValueIds.push(ageFvId);

    const colorFvId = entry.colorFacetGuess ? findFacetValueId('color', entry.colorFacetGuess) : undefined;

    const sizeFacetKey = pickSizeFacetKey(entry);
    const sizeFacet = sizeFacetKey ? facetByKey.get(sizeFacetKey) : undefined;
    const sizeValues = sizeFacet ? [...sizeFacet.values].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];

    const contentHash8 = entry.contentHash.slice(0, 8).toUpperCase();
    const dimension = sizeValues.length ? sizeValues : [null];

    const variants = dimension.map((sv) => {
      const facetValueIds: string[] = [];
      if (colorFvId) facetValueIds.push(colorFvId);
      if (sv) facetValueIds.push(sv.id);
      const sizeSuffix = sv ? sv.value.toUpperCase().replace(/\./g, '') : 'STD';
      return {
        sku: `DEV-${contentHash8}-${sizeSuffix}`,
        price: PLACEHOLDER_PRICE,
        stockQuantity: 0,
        attributes: [],
        facetValueIds,
      };
    });

    const nameStartsWithBrand = entry.nameGuess.toLowerCase().startsWith((entry.brand ?? '').toLowerCase());
    const description = nameStartsWithBrand ? `${entry.nameGuess}.` : `${entry.brand} ${entry.nameGuess}.`;

    try {
      const product = await productsService.create({
        categoryId: category.id,
        brandId,
        name: entry.nameGuess,
        slug,
        description,
        status: product_status.active,
        featured: false,
        variants,
        facetValueIds: productFacetValueIds,
      } as Parameters<typeof productsService.create>[0]);

      created++;

      if (process.env.ALLOW_IMAGE_UPLOAD !== '1') {
        imagesSkippedByGuard++;
        report.push({
          file: entry.file,
          status: 'image_upload_skipped',
          productId: product.id,
          slug,
          sku: variants[0]?.sku,
          reason: 'ALLOW_IMAGE_UPLOAD not set to 1',
        });
      } else {
        try {
          const filePath = join(STORAGES_ROOT, entry.file);
          const buffer = readFileSync(filePath);
          const ext = entry.file.split('.').pop()?.toLowerCase() || 'jpg';
          const mimetype = ext === 'png' ? 'image/png' : 'image/jpeg';
          const fakeFile = {
            buffer,
            originalname: `${slug}.${ext}`,
            mimetype,
            fieldname: 'files',
            encoding: '7bit',
            size: buffer.length,
          } as Express.Multer.File;

          await productsService.addImages(product.id, [fakeFile]);
          imagesUploaded++;
          report.push({ file: entry.file, status: 'created', productId: product.id, slug, sku: variants[0]?.sku });
        } catch (imgErr) {
          imageFailures++;
          report.push({
            file: entry.file,
            status: 'product_created_image_failed',
            productId: product.id,
            slug,
            error: imgErr instanceof Error ? imgErr.message : String(imgErr),
          });
        }
      }
    } catch (err) {
      errors++;
      report.push({
        file: entry.file,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('=== Resumo da inserção ===');
  console.log(`Produtos criados: ${created}`);
  console.log(`Imagens enviadas: ${imagesUploaded} | Falha de imagem (produto ficou sem foto): ${imageFailures} | Puladas pela trava ALLOW_IMAGE_UPLOAD: ${imagesSkippedByGuard}`);
  console.log(`Pulados (marca/categoria não resolvida): ${skipped}`);
  console.log(`Erros (produto não criado): ${errors}`);
  console.log(`\nRelatório completo: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
