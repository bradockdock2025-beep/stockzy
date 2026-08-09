/**
 * Insere os 39 jerseys de STORAGES_SAMPLE_UPLOAD/storage-clothes-tshir-jersy_files/
 * como produtos em Apparel > Tops, tagueados com a faceta garment_type=jersey (ver
 * ANALISE_MAPEAMENTO_PLP_JERSEYS.md e SQL_GARMENT_TYPE_FACET_SEED.sql).
 *
 * Lote pequeno e específico — script dedicado em vez de estender
 * scripts/seed-products-from-storages.ts (que é movido a manifesto pra STORAGES/
 * inteiro, 530 produtos). Mesmas convenções de dado (preço placeholder 99.99,
 * status=active, grade de tamanho completa via size_apparel, estoque 0, SKU
 * "DEV-{hash8}-{tamanho}").
 *
 * Pré-requisito no banco de destino: SQL_GARMENT_TYPE_FACET_SEED.sql já aplicado
 * (senão o produto é criado sem essa tag, com aviso no console).
 *
 * Trava de segurança: upload de imagem só roda com ALLOW_IMAGE_UPLOAD=1 explícito.
 *
 * Uso: npx ts-node -T -O '{"module":"commonjs"}' -r tsconfig-paths/register scripts/seed-jerseys-from-storage.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { product_status } from '@prisma/client';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ProductsModule } from '../src/modules/products/products.module';
import { ProductsService } from '../src/modules/products/products.service';
import { PrismaService } from '../src/database/prisma.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), ProductsModule] })
class SeedBootstrapModule {}

const SOURCE_DIR = join(__dirname, '..', 'STORAGES_SAMPLE_UPLOAD', 'storage-clothes-tshir-jersy_files');
const REPORT_PATH = join(__dirname, '..', 'SEED_JERSEYS_REPORT.json');
const PLACEHOLDER_PRICE = 99.99;

const BRAND_PATTERNS: Array<{ re: RegExp; brand: string }> = [
  { re: /^adidas/i, brand: 'adidas' },
  { re: /^nike/i, brand: 'Nike' },
  { re: /^jordan/i, brand: 'Jordan' },
  { re: /^kaws/i, brand: 'KAWS' },
  { re: /^supreme/i, brand: 'Supreme' },
  { re: /^palace/i, brand: 'Palace' },
  { re: /^kith/i, brand: 'Kith' },
];

const KNOWN_JERSEY_FILES = readdirSync(SOURCE_DIR).filter(
  (f) => /jersey|t-shirt/i.test(f) && /\.(jpg|jpeg|png)$/i.test(f),
);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripSuffixes(nameNoExt: string): string {
  return nameNoExt
    .replace(/-Product$/i, '')
    .replace(/-[Vv]\d+$/i, '')
    .replace(/-\d+$/i, '')
    .replace(/-Product$/i, '');
}

function detectBrandAndCollab(nameNoExt: string): { brand: string | null; isCollab: boolean; rest: string } {
  const segments = nameNoExt.split(/-x-/i);
  const isCollab = segments.length > 1;

  if (!isCollab) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(nameNoExt));
    return { brand: match ? match.brand : null, isCollab: false, rest: nameNoExt };
  }

  let brand: string | null = null;
  for (const seg of segments) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(seg));
    if (match) { brand = match.brand; break; }
  }
  // Collab: mantém o nome inteiro ("-x-" vira " x ") — mesma decisão de
  // organize-storages.ts, o produto de verdade normalmente está no segmento
  // seguinte ao da marca, não dá pra só cortar o prefixo.
  const rest = nameNoExt.replace(/-x-/gi, ' x ');
  return { brand, isCollab: true, rest };
}

const COLOR_WORDS: Record<string, string> = {
  black: 'black', white: 'white', multi: 'multi', multicolor: 'multi',
  blue: 'blue', grey: 'grey', gray: 'grey', red: 'red', yellow: 'yellow',
  brown: 'brown', pink: 'pink', purple: 'purple', green: 'green', orange: 'orange',
};

function detectColor(nameNoExt: string): string | null {
  const tokens = nameNoExt.toLowerCase().split(/[-\s]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (COLOR_WORDS[tokens[i]]) return COLOR_WORDS[tokens[i]];
  }
  return null;
}

async function main() {
  console.log(`${KNOWN_JERSEY_FILES.length} arquivos de jersey encontrados em ${SOURCE_DIR}`);

  const app = await NestFactory.createApplicationContext(SeedBootstrapModule, { logger: ['error', 'warn'] });
  const productsService = app.get(ProductsService);
  const prisma = app.get(PrismaService);

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  const topsCategory = await prisma.category.findFirst({ where: { slug: 'tops' }, select: { id: true } });
  if (!topsCategory) throw new Error('Categoria "tops" não encontrada — rode SQL_CATEGORIES_SEED.sql antes.');

  const facets = await prisma.facet.findMany({
    select: { id: true, key: true, values: { select: { id: true, value: true, sortOrder: true } } },
  });
  const facetByKey = new Map(facets.map((f) => [f.key, f]));
  const findFacetValueId = (key: string, value: string) =>
    facetByKey.get(key)?.values.find((v) => v.value === value)?.id;

  const genderFvId = findFacetValueId('gender', 'men');
  const garmentTypeJerseyFvId = findFacetValueId('garment_type', 'jersey');
  const garmentTypeTeeFvId = findFacetValueId('garment_type', 't-shirt');
  if (!garmentTypeJerseyFvId) {
    console.warn('AVISO: faceta garment_type=jersey não encontrada — rode SQL_GARMENT_TYPE_FACET_SEED.sql antes. Produtos serão criados SEM essa tag.');
  }

  const sizeFacet = facetByKey.get('size_apparel');
  const sizeValues = sizeFacet ? [...sizeFacet.values].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];
  if (!sizeValues.length) throw new Error('Faceta size_apparel sem valores — rode SQL_CATALOG_FACETS_SEED.sql antes.');

  const usedSlugs = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let created = 0, imagesUploaded = 0, imageFailures = 0, imagesSkippedByGuard = 0, skipped = 0, errors = 0;

  for (const file of KNOWN_JERSEY_FILES) {
    const ext = file.slice(file.lastIndexOf('.'));
    const nameNoExt = file.slice(0, -ext.length);
    const cleanedName = stripSuffixes(nameNoExt);

    const { brand, isCollab, rest } = detectBrandAndCollab(cleanedName);
    if (!brand) {
      report.push({ file, status: 'skipped', reason: 'brand_unmatched' });
      skipped++;
      continue;
    }
    const brandId = brandBySlug.get(slugify(brand));
    if (!brandId) {
      report.push({ file, status: 'skipped', reason: `brand not found in DB: ${brand}` });
      skipped++;
      continue;
    }

    const nameGuess = (
      isCollab ? rest.replace(/-/g, ' ') : rest.replace(new RegExp(`^${brand.replace(/ /g, '-')}-?`, 'i'), '').replace(/-/g, ' ')
    ).trim() || cleanedName.replace(/-/g, ' ').trim();

    const colorFvId0 = detectColor(cleanedName);
    const colorFvId = colorFvId0 ? findFacetValueId('color', colorFvId0) : undefined;

    let baseSlug = slugify(`${brand}-${nameGuess}`);
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const buffer = readFileSync(join(SOURCE_DIR, file));
    const contentHash8 = createHash('sha256').update(buffer).digest('hex').slice(0, 8).toUpperCase();

    const variants = sizeValues.map((sv) => {
      const facetValueIds: string[] = [];
      if (colorFvId) facetValueIds.push(colorFvId);
      facetValueIds.push(sv.id);
      return {
        sku: `DEV-${contentHash8}-${sv.value.toUpperCase()}`,
        price: PLACEHOLDER_PRICE,
        stockQuantity: 0,
        facetValueIds,
      };
    });

    const isTee = /t-shirt/i.test(cleanedName) && !/jersey/i.test(cleanedName);
    const garmentTypeFvId = isTee ? garmentTypeTeeFvId : garmentTypeJerseyFvId;
    const productFacetValueIds = [genderFvId, garmentTypeFvId].filter((id): id is string => !!id);
    const nameStartsWithBrand = nameGuess.toLowerCase().startsWith(brand.toLowerCase());
    const description = nameStartsWithBrand ? `${nameGuess}.` : `${brand} ${nameGuess}.`;

    try {
      const product = await productsService.create({
        categoryId: topsCategory.id,
        brandId,
        name: nameGuess,
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
        report.push({ file, status: 'image_upload_skipped', productId: product.id, slug, reason: 'ALLOW_IMAGE_UPLOAD not set to 1' });
      } else {
        try {
          const mimetype = ext.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
          const fakeFile = {
            buffer, originalname: `${slug}${ext}`, mimetype, fieldname: 'files', encoding: '7bit', size: buffer.length,
          } as Express.Multer.File;
          await productsService.addImages(product.id, [fakeFile]);
          imagesUploaded++;
          report.push({ file, status: 'created', productId: product.id, slug });
        } catch (imgErr) {
          imageFailures++;
          report.push({ file, status: 'product_created_image_failed', productId: product.id, slug, error: imgErr instanceof Error ? imgErr.message : String(imgErr) });
        }
      }
    } catch (err) {
      errors++;
      report.push({ file, status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('=== Resumo ===');
  console.log(`Produtos criados: ${created}`);
  console.log(`Imagens enviadas: ${imagesUploaded} | Falha de imagem: ${imageFailures} | Puladas pela trava ALLOW_IMAGE_UPLOAD: ${imagesSkippedByGuard}`);
  console.log(`Pulados (marca não resolvida): ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Relatório completo: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
