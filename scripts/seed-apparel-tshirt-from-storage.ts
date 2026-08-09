/**
 * Insere os produtos reais de STORAGES_SAMPLE_UPLOAD/Sell-Apparel-category-tshirt_files/
 * nas subcategorias corretas de Apparel (Tops/Bottoms/Outerwear/Undergarments), com
 * facet garment_type quando aplicável (jersey/t-shirt, mesma faceta dos lotes
 * anteriores). Exclui o placeholder de ruído.
 *
 * Vários arquivos deste lote são os MESMOS de folders já processados antes (jerseys,
 * e alguns produtos do seed original) — vão falhar com "unique constraint (slug)",
 * o que é esperado (a constraint impede duplicata), não é bug. Ver relatório pra ver
 * quais.
 *
 * 1 variante por produto (sem grade de tamanho — apparel de vestuário genérico não
 * precisa da grade completa que jerseys usam), preço placeholder 99.99, estoque 0.
 *
 * Pré-requisito: SQL_APPAREL_TSHIRT_BRANDS_SEED.sql aplicado (só Hellstar é novo).
 * Trava de segurança: upload de imagem só roda com ALLOW_IMAGE_UPLOAD=1 explícito.
 *
 * Uso: npx ts-node -T -O '{"module":"commonjs"}' -r tsconfig-paths/register scripts/seed-apparel-tshirt-from-storage.ts
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

const SOURCE_DIR = join(__dirname, '..', 'STORAGES_SAMPLE_UPLOAD', 'Sell-Apparel-category-tshirt_files');
const REPORT_PATH = join(__dirname, '..', 'SEED_APPAREL_TSHIRT_REPORT.json');
const PLACEHOLDER_PRICE = 99.99;

const EXCLUDED_FILES = new Set([
  'Product-Placeholder-Default-20210415.jpg',
]);

const BRAND_PATTERNS: Array<{ re: RegExp; brand: string }> = [
  { re: /^anti-social-social-club/i, brand: 'Anti Social Social Club' },
  { re: /^billionaire-boys-club/i, brand: 'Billionaire Boys Club' },
  { re: /^eric-emanuel/i, brand: 'Eric Emanuel' },
  { re: /^fear-of-god-essentials/i, brand: 'Fear of God Essentials' },
  { re: /^godspeed/i, brand: 'Godspeed' },
  { re: /^gymshark/i, brand: 'Gymshark' },
  { re: /^hellstar/i, brand: 'Hellstar' },
  { re: /^kith/i, brand: 'Kith' },
  { re: /^nike/i, brand: 'Nike' },
  { re: /^palace/i, brand: 'Palace' },
  { re: /^supreme/i, brand: 'Supreme' },
  { re: /^adidas/i, brand: 'adidas' },
];

// Tops checado ANTES de bottoms de propósito: "Short-Sleeve-Tee" contém "short" E
// "tee" — se bottoms fosse checado primeiro, uma camiseta de manga curta virava
// "bottoms" por engano. "shorts" não colide com "shirt" (letras diferentes), então
// essa ordem não quebra a classificação de shorts de verdade.
const APPAREL_SUB_KEYWORDS: Array<{ re: RegExp; sub: string }> = [
  { re: /hoodie|sweatshirt|jacket|windrunner/i, sub: 'outerwear' },
  { re: /boxer|brief|sock|underwear/i, sub: 'undergarments' },
  { re: /tee|t-shirt|shirt|jersey|polo|rugby/i, sub: 'tops' },
  { re: /short|sweatpant|pant|legging/i, sub: 'bottoms' },
];

function classifySub(nameNoExt: string): string {
  const hit = APPAREL_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
  return hit ? hit.sub : 'tops';
}

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function stripSuffixes(nameNoExt: string): string {
  return nameNoExt.replace(/-Product$/i, '').replace(/-[Vv]\d+$/i, '').replace(/-\d+$/i, '').replace(/-Product$/i, '');
}

function detectBrandAndCollab(nameNoExt: string): { brand: string | null; brandMatchText: string | null; isCollab: boolean; rest: string } {
  const segments = nameNoExt.split(/-x-/);
  const isCollab = segments.length > 1;

  if (!isCollab) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(nameNoExt));
    const matchText = match ? nameNoExt.match(match.re)?.[0] ?? null : null;
    return { brand: match ? match.brand : null, brandMatchText: matchText, isCollab: false, rest: nameNoExt };
  }

  let brand: string | null = null;
  for (const seg of segments) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(seg));
    if (match) { brand = match.brand; break; }
  }
  const rest = nameNoExt.replace(/-x-/g, ' x ');
  return { brand, brandMatchText: null, isCollab: true, rest };
}

const COLOR_WORDS: Record<string, string> = {
  black: 'black', white: 'white', multi: 'multi', multicolor: 'multi',
  blue: 'blue', grey: 'grey', gray: 'grey', red: 'red', yellow: 'yellow',
  brown: 'brown', pink: 'pink', purple: 'purple', green: 'green', orange: 'orange',
  silver: 'silver',
};

function detectColor(nameNoExt: string): string | null {
  const tokens = nameNoExt.toLowerCase().split(/[-\s]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (COLOR_WORDS[tokens[i]]) return COLOR_WORDS[tokens[i]];
  }
  return null;
}

async function main() {
  const allFiles = readdirSync(SOURCE_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const files = allFiles.filter((f) => !EXCLUDED_FILES.has(f));
  console.log(`${allFiles.length} arquivos na pasta, ${files.length} após excluir ${EXCLUDED_FILES.size} de ruído.`);

  const app = await NestFactory.createApplicationContext(SeedBootstrapModule, { logger: ['error', 'warn'] });
  const productsService = app.get(ProductsService);
  const prisma = app.get(PrismaService);

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const facets = await prisma.facet.findMany({ select: { id: true, key: true, values: { select: { id: true, value: true } } } });
  const facetByKey = new Map(facets.map((f) => [f.key, f]));
  const findFacetValueId = (key: string, value: string) => facetByKey.get(key)?.values.find((v) => v.value === value)?.id;
  const garmentTypeJerseyFvId = findFacetValueId('garment_type', 'jersey');
  const garmentTypeTeeFvId = findFacetValueId('garment_type', 't-shirt');
  const garmentTypeHoodieFvId = findFacetValueId('garment_type', 'hoodie');

  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let created = 0, imagesUploaded = 0, imageFailures = 0, imagesSkippedByGuard = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const ext = file.slice(file.lastIndexOf('.'));
    const nameNoExt = file.slice(0, -ext.length);
    const cleanedName = stripSuffixes(nameNoExt);

    const { brand, brandMatchText, isCollab, rest } = detectBrandAndCollab(cleanedName);
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

    const subSlug = classifySub(cleanedName);
    const category = categoryBySlug.get(subSlug);
    if (!category) {
      report.push({ file, status: 'skipped', reason: `category not found: ${subSlug}` });
      skipped++;
      continue;
    }

    const nameGuess = (
      isCollab ? rest.replace(/-/g, ' ') : rest.replace(new RegExp(`^${brandMatchText}-?`), '').replace(/-/g, ' ')
    ).trim() || cleanedName.replace(/-/g, ' ').trim();

    const colorValue = detectColor(cleanedName);
    const colorFvId = colorValue ? findFacetValueId('color', colorValue) : undefined;

    let baseSlug = slugify(`${brand}-${nameGuess}`);
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const buffer = readFileSync(join(SOURCE_DIR, file));
    const contentHash8 = createHash('sha256').update(buffer).digest('hex').slice(0, 8).toUpperCase();
    let sku = `DEV-${contentHash8}-STD`;
    let skuN = 2;
    while (usedSkus.has(sku)) sku = `DEV-${contentHash8}-STD${skuN++}`;
    usedSkus.add(sku);

    const isJersey = /jersey/i.test(cleanedName);
    const isTee = !isJersey && /tee|t-shirt/i.test(cleanedName);
    const isHoodie = /hoodie/i.test(cleanedName);
    const garmentTypeFvId = isJersey ? garmentTypeJerseyFvId : isTee ? garmentTypeTeeFvId : isHoodie ? garmentTypeHoodieFvId : undefined;

    const variants = [{
      sku, price: PLACEHOLDER_PRICE, stockQuantity: 0,
      facetValueIds: colorFvId ? [colorFvId] : [],
    }];

    const nameStartsWithBrand = nameGuess.toLowerCase().startsWith(brand.toLowerCase());
    const description = nameStartsWithBrand ? `${nameGuess}.` : `${brand} ${nameGuess}.`;

    try {
      const product = await productsService.create({
        categoryId: category.id,
        brandId,
        name: nameGuess,
        slug,
        description,
        status: product_status.active,
        featured: false,
        variants,
        facetValueIds: garmentTypeFvId ? [garmentTypeFvId] : [],
      } as Parameters<typeof productsService.create>[0]);

      created++;

      if (process.env.ALLOW_IMAGE_UPLOAD !== '1') {
        imagesSkippedByGuard++;
        report.push({ file, status: 'image_upload_skipped', productId: product.id, slug, category: subSlug, reason: 'ALLOW_IMAGE_UPLOAD not set to 1' });
      } else {
        try {
          const mimetype = ext.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
          const fakeFile = {
            buffer, originalname: `${slug}${ext}`, mimetype, fieldname: 'files', encoding: '7bit', size: buffer.length,
          } as Express.Multer.File;
          await productsService.addImages(product.id, [fakeFile]);
          imagesUploaded++;
          report.push({ file, status: 'created', productId: product.id, slug, category: subSlug });
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
  console.log(`Pulados (marca/categoria não resolvida): ${skipped}`);
  console.log(`Erros (provavelmente duplicatas de lotes anteriores): ${errors}`);
  console.log(`Relatório completo: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
