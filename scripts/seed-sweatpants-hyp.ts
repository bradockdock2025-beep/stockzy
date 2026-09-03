/**
 * Insere os 122 Sweatpants de HYP_SWEATPANTS_CATALOG.json — dados REAIS extraídos
 * do catálogo público de hypmiami.com/products.json (nome, marca, preço, tamanho e
 * condição de cada peça), pareados por hash de imagem com os arquivos salvos em
 * .../ProjetBanzylo/Streetpaints_files/. Não é dado inventado: cada produto/variante
 * reflete exatamente o que a loja tinha listado publicamente em 2026-08-30.
 *
 * Decisões confirmadas com o usuário (2026-08-30):
 *   - Preço REAL de cada variante (não placeholder) — vem de HYP_SWEATPANTS_CATALOG.json.
 *   - status='active' direto (preço já é real, não precisa ficar em draft).
 *   - stockQuantity=5 por variante (uniforme, mesmo critério do drop anterior — mesmo
 *     sendo peça de brechó/consignado onde o real seria 1 unidade única).
 *   - "Happy Memories Don't Die" (grafia da fonte) reaproveita o brand_id já existente
 *     de "Happy Memories Dont Die" (sem apóstrofo) do drop anterior.
 *   - "Matty Boy" entra como marca própria desta vez — ao contrário do drop anterior
 *     (onde foi inferência por nome de arquivo), aqui é o próprio catálogo da loja que
 *     lista "Matty Boy" como vendor, então a fonte é mais confiável que a inferência.
 *   - Categoria: todos vão para Apparel > Bottoms (é isso que "sweatpants" é).
 *   - Tamanho combinado tipo "L/XL" ou "S/M": faceta size_apparel usa o primeiro
 *     token (L, S) como aproximação — o `title` da variante guarda o valor completo
 *     original, então nada se perde, só a faceta de filtro fica no tamanho mais
 *     próximo. "XXXL" não tem correspondência em size_apparel — variante é criada
 *     sem faceta de tamanho (fica de fora do filtro, mas existe e é comprável).
 *
 * Pré-requisito: SQL_BRANDS_SEED_SWEATPANTS_HYP.sql já aplicado (15 marcas novas).
 * Trava de segurança: upload de imagem só roda com ALLOW_IMAGE_UPLOAD=1 explícito.
 *
 * Uso: NODE_ENV=development ALLOW_IMAGE_UPLOAD=1 npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' -r tsconfig-paths/register scripts/seed-sweatpants-hyp.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { product_status } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { ProductsModule } from '../src/modules/products/products.module';
import { ProductsService } from '../src/modules/products/products.service';
import { PrismaService } from '../src/database/prisma.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), ProductsModule] })
class SeedBootstrapModule {}

const CATALOG_PATH = join(__dirname, '..', 'HYP_SWEATPANTS_CATALOG.json');
const IMAGES_DIR = join(
  '/Users/macbookpro/Documents/ECOMERCY-PROJECTS/ECO-IDEIA/BANZELO-PICS/BAZELO-WORKS/ProjetBanzylo',
  'Streetpaints_files',
);
const REPORT_PATH = join(__dirname, '..', 'SEED_SWEATPANTS_HYP_REPORT.json');
const STOCK_QUANTITY = 5;

// vendor (da fonte) -> slug de marca já existente no banco, quando difere por grafia
const VENDOR_SLUG_OVERRIDE: Record<string, string> = {
  "Happy Memories Don’t Die": 'happy-memories-dont-die',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CatalogVariant {
  sku_source: string;
  title: string;
  size_raw: string | null;
  condition: string | null;
  price: string;
}
interface CatalogProduct {
  source_id: number;
  title: string;
  vendor: string;
  handle: string;
  files: string[];
  variants: CatalogVariant[];
}

async function main() {
  const catalog: CatalogProduct[] = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Produtos no catálogo: ${catalog.length}`);

  const app = await NestFactory.createApplicationContext(SeedBootstrapModule, { logger: ['error', 'warn'] });
  const productsService = app.get(ProductsService);
  const prisma = app.get(PrismaService);

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const bottomsCategory = categories.find((c) => c.slug === 'bottoms');
  if (!bottomsCategory) throw new Error('categoria "bottoms" não encontrada — rode SQL_CATEGORIES_SEED.sql');

  const facets = await prisma.facet.findMany({ select: { id: true, key: true, values: { select: { id: true, value: true } } } });
  const sizeApparelFacet = facets.find((f) => f.key === 'size_apparel');
  if (!sizeApparelFacet) throw new Error('facet "size_apparel" não encontrada');
  const sizeValueByLabel = new Map(sizeApparelFacet.values.map((v) => [v.value.toLowerCase(), v.id]));

  function resolveSizeFacetId(sizeRaw: string | null): string | undefined {
    if (!sizeRaw) return undefined;
    const first = sizeRaw.split('/')[0].trim().toLowerCase();
    return sizeValueByLabel.get(first);
  }

  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let created = 0, imagesUploaded = 0, imageFailures = 0, imagesSkippedByGuard = 0, skipped = 0, errors = 0, sizeUnmatched = 0;

  for (const item of catalog) {
    const vendorSlug = slugify(VENDOR_SLUG_OVERRIDE[item.vendor] ?? item.vendor);
    const brandId = brandBySlug.get(vendorSlug);
    if (!brandId) {
      report.push({ source_id: item.source_id, title: item.title, status: 'skipped', reason: `brand not found: ${item.vendor} (slug ${vendorSlug}) — rode SQL_BRANDS_SEED_SWEATPANTS_HYP.sql` });
      skipped++;
      continue;
    }

    let baseSlug = slugify(item.title);
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const variants = item.variants.map((v) => {
      const sizeLabel = (v.size_raw ?? v.title).toUpperCase().replace(/[^A-Z0-9]+/g, '');
      let sku = `HYP-${v.sku_source.replace(/[^A-Za-z0-9]+/g, '')}-${sizeLabel}`.toUpperCase();
      let skuN = 2;
      while (usedSkus.has(sku)) sku = `HYP-${v.sku_source.replace(/[^A-Za-z0-9]+/g, '')}-${sizeLabel}${skuN++}`.toUpperCase();
      usedSkus.add(sku);

      const sizeFvId = resolveSizeFacetId(v.size_raw);
      if (v.size_raw && !sizeFvId) sizeUnmatched++;

      return {
        sku,
        title: v.title,
        price: Number(v.price),
        stockQuantity: STOCK_QUANTITY,
        facetValueIds: sizeFvId ? [sizeFvId] : [],
      };
    });

    const nameStartsWithBrand = item.title.toLowerCase().startsWith(item.vendor.toLowerCase());
    const description = nameStartsWithBrand ? `${item.title}.` : `${item.vendor} ${item.title}.`;

    try {
      const product = await productsService.create({
        categoryId: bottomsCategory.id,
        brandId,
        name: item.title,
        slug,
        description,
        status: product_status.active,
        featured: false,
        variants,
      } as Parameters<typeof productsService.create>[0]);

      created++;

      if (process.env.ALLOW_IMAGE_UPLOAD !== '1') {
        imagesSkippedByGuard += item.files.length;
        report.push({ source_id: item.source_id, status: 'image_upload_skipped', productId: product.id, slug, brand: item.vendor, imageCount: item.files.length, files: item.files, reason: 'ALLOW_IMAGE_UPLOAD not set to 1' });
      } else {
        let uploadedForThisProduct = 0;
        const failedFiles: string[] = [];
        for (const filename of item.files) {
          try {
            const fileBuffer = readFileSync(join(IMAGES_DIR, filename));
            const ext = extname(filename).toLowerCase();
            const mimetype = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            const fakeFile = {
              buffer: fileBuffer, originalname: filename, mimetype, fieldname: 'files', encoding: '7bit', size: fileBuffer.length,
            } as Express.Multer.File;
            await productsService.addImages(product.id, [fakeFile]);
            uploadedForThisProduct++;
            imagesUploaded++;
          } catch (imgErr) {
            imageFailures++;
            failedFiles.push(filename);
          }
        }
        report.push({ source_id: item.source_id, status: 'created', productId: product.id, slug, brand: item.vendor, imagesUploaded: uploadedForThisProduct, imagesFailed: failedFiles });
      }
    } catch (err) {
      errors++;
      report.push({ source_id: item.source_id, title: item.title, status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n=== Resumo ===');
  console.log(`Produtos criados: ${created}`);
  console.log(`Imagens enviadas: ${imagesUploaded} | Falha de imagem: ${imageFailures} | Puladas pela trava ALLOW_IMAGE_UPLOAD: ${imagesSkippedByGuard}`);
  console.log(`Pulados (marca não resolvida): ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Variantes com tamanho sem correspondência em size_apparel (sem faceta, mas criadas): ${sizeUnmatched}`);
  console.log(`Relatório completo: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
