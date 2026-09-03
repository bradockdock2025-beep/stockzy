/**
 * Insere os Product Items do novo drop de imagens em
 * frontend/public/images/{sneakers,apparel,accessories} +
 * frontend/public/home-products/{new-arrivals-*,chromehearts,enfantsrichesdeprimes,
 * palyhollywood,satoshinakamoto,valeforever,bottegadesires} (home-products/about/
 * excluído — é banner institucional, não produto).
 *
 * Análise prévia (ver PUBLIC_IMAGES_MANIFEST.json / conversa 2026-08-21):
 *   - 798 imagens totais, 26 duplicadas por conteúdo entre images/ e home-products/
 *     (deduplicadas por sha256, mantém só a primeira ocorrência).
 *   - 55% dos arquivos têm nome opaco tipo scraper (ex.: "bjzpaxvdyy4bxiypsykl.jpg"),
 *     sem marca/modelo/cor legível — EXCLUÍDOS deste import por decisão do usuário
 *     (não inventar produto a partir de nome sem informação).
 *   - Resultado: 127 Product Items (63 accessories, 30 apparel, 34 sneakers).
 *
 * Regras acordadas com o usuário:
 *   - status='draft' (default do schema, invisível na loja) + price=0 (placeholder
 *     sentinela, óbvio que não é preço real) — não existe fonte de preço real pros
 *     itens deste drop. Editar preço real pelo admin antes de publicar (status=active).
 *   - stockQuantity=0 (campo obrigatório no schema; 0 = "ainda não inventariado").
 *   - sneakers vão direto pra categoria raiz "Sneakers" — as subcategorias
 *     Lifestyle/Luxury/Performance são um tier de estilo que não dá pra inferir do
 *     nome do arquivo, não force um valor pra não inventar dado.
 *   - apparel/accessories vão pra subcategoria via keyword no nome; sem match =
 *     "Other Apparel"/"Other Accessories" (nunca um chute tipo "tops" por padrão).
 *   - "Matty-Boy-Anti-Promo-Stay-Fast-Patch-Beanie-Blue.jpg" (único arquivo standalone
 *     desse nome) é tratado como Chrome Hearts (colab), não marca própria — Matty Boy
 *     só aparece como colaborador em todo o resto do dataset.
 *   - "Bottega Desires" É cadastrada como marca própria (decisão explícita do usuário,
 *     apesar de ter cara de handle de curador).
 *
 * Pré-requisito: SQL_BRANDS_SEED_LUXURY_DROP.sql já aplicado (19 marcas novas).
 * Trava de segurança: upload de imagem pro Supabase Storage só roda com
 * ALLOW_IMAGE_UPLOAD=1 explícito — sem isso, cria os produtos mas pula o upload,
 * pra dar pra revisar antes de subir 250+ arquivos de verdade.
 *
 * Uso (dry run, sem upload de imagem):
 *   npx ts-node -T -O '{"module":"commonjs"}' -r tsconfig-paths/register scripts/seed-luxury-drop-from-public.ts
 * Uso real (com upload):
 *   ALLOW_IMAGE_UPLOAD=1 npx ts-node -T -O '{"module":"commonjs"}' -r tsconfig-paths/register scripts/seed-luxury-drop-from-public.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { product_status } from '@prisma/client';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';
import { ProductsModule } from '../src/modules/products/products.module';
import { ProductsService } from '../src/modules/products/products.service';
import { PrismaService } from '../src/database/prisma.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), ProductsModule] })
class SeedBootstrapModule {}

const PUBLIC_ROOT = join(__dirname, '..', 'frontend', 'public');
const IMAGES_ROOT = join(PUBLIC_ROOT, 'images');
const HOME_PRODUCTS_ROOT = join(PUBLIC_ROOT, 'home-products');
const REPORT_PATH = join(__dirname, '..', 'SEED_LUXURY_DROP_REPORT.json');

const PLACEHOLDER_PRICE = 0;
const PLACEHOLDER_STOCK = 0;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const EXCLUDED_HOME_FOLDERS = new Set(['about']);

const IMAGES_FOLDER_CATEGORY: Record<string, 'sneakers' | 'apparel' | 'accessories'> = {
  sneakers: 'sneakers',
  apparel: 'apparel',
  accessories: 'accessories',
};
const HOME_FOLDER_CATEGORY: Record<string, 'sneakers' | 'apparel' | 'accessories'> = {
  'new-arrivals-sneakers': 'sneakers',
  'new-arrivals-apparel': 'apparel',
  'new-arrivals-accessories': 'accessories',
};
const APPAREL_KEYWORDS = /hoodie|sweatshirt|jersey|tee|t-shirt|shirt|short|pant|jacket|polo|sock|boxer|brief|trouser/i;
const ACCESSORY_KEYWORDS = /backpack|bag|watch|wallet|belt|cap|beanie|hat|glasses|eyewear|jewelry|keychain|lanyard|ring|pendant|figurine|bearbrick/i;
const SNEAKER_KEYWORDS = /sneaker|dunk|jordan|yeezy|air-force|air-max|replica|b30|gel-|2002r/i;

const BRAND_PATTERNS: Array<{ re: RegExp; brand: string }> = [
  { re: /^air-jordan/i, brand: 'Jordan' },
  { re: /^jordan/i, brand: 'Jordan' },
  { re: /^nike/i, brand: 'Nike' },
  { re: /^yzy/i, brand: 'Yeezy' },
  { re: /^adidas-yeezy/i, brand: 'Yeezy' },
  { re: /^adidas/i, brand: 'adidas' },
  { re: /^new-balance/i, brand: 'New Balance' },
  { re: /^asics/i, brand: 'ASICS' },
  { re: /^supreme/i, brand: 'Supreme' },
  { re: /^fear-of-god-essentials/i, brand: 'Fear of God Essentials' },
  { re: /^sprayground/i, brand: 'Sprayground' },
  { re: /^palace/i, brand: 'Palace' },
  { re: /^gymshark/i, brand: 'Gymshark' },
  { re: /^kith/i, brand: 'Kith' },
  { re: /^swatch/i, brand: 'Swatch' },
  { re: /^the-north-face/i, brand: 'The North Face' },
  { re: /^godspeed/i, brand: 'Godspeed' },
  { re: /^eric-emanuel/i, brand: 'Eric Emanuel' },
  { re: /^crocs/i, brand: 'Crocs' },
  { re: /^bravest-studios/i, brand: 'Bravest Studios' },
  { re: /^birkenstock/i, brand: 'Birkenstock' },
  { re: /^bape/i, brand: 'BAPE' },
  { re: /^anti-social-social-club/i, brand: 'Anti Social Social Club' },
  { re: /^aime-leon-dore/i, brand: 'Aime Leon Dore' },
  { re: /^alexander-mcqueen/i, brand: 'Alexander McQueen' },
  { re: /^altra/i, brand: 'Altra' },
  { re: /^amiri/i, brand: 'AMIRI' },
  { re: /^anta/i, brand: 'Anta' },
  { re: /^arc'?teryx/i, brand: "Arc'teryx" },
  { re: /^atmos/i, brand: 'Atmos' },
  { re: /^autry/i, brand: 'Autry' },
  { re: /^awake/i, brand: 'Awake' },
  { re: /^axel-arigato/i, brand: 'Axel Arigato' },
  { re: /^balenciaga/i, brand: 'Balenciaga' },
  { re: /^billionaire-boys-club/i, brand: 'Billionaire Boys Club' },
  { re: /^bottega-veneta/i, brand: 'Bottega Veneta' },
  { re: /^brain-dead/i, brand: 'Brain Dead' },
  { re: /^onitsuka-?tiger/i, brand: 'Onitsuka Tiger' },
  { re: /^puma/i, brand: 'Puma' },
  { re: /^ugg/i, brand: 'UGG' },
  { re: /^timberland/i, brand: 'Timberland' },
  { re: /^louis-vuitton/i, brand: 'Louis Vuitton' },
  { re: /^saint-laurent/i, brand: 'Saint Laurent' },
  { re: /^mihara-yasuhiro|^maison-mihara-yasuhiro/i, brand: 'Maison MIHARA YASUHIRO' },
  { re: /^chrome-hearts?/i, brand: 'Chrome Hearts' },
  { re: /^chrome-heart-x/i, brand: 'Chrome Hearts' },
  { re: /^goyard/i, brand: 'Goyard' },
  { re: /^hermes/i, brand: 'Hermès' },
  { re: /^rick-owens/i, brand: 'Rick Owens' },
  { re: /^maison-margiela/i, brand: 'Maison Margiela' },
  { re: /^marni/i, brand: 'Marni' },
  { re: /^dior/i, brand: 'Dior' },
  { re: /^rhude/i, brand: 'Rhude' },
  { re: /^acne-studios/i, brand: 'Acne Studios' },
  { re: /^enfants-riches-deprimes/i, brand: 'Enfants Riches Deprimes' },
  { re: /^77-studios/i, brand: '77 Studios' },
  { re: /^happy-memories-dont-die/i, brand: 'Happy Memories Dont Die' },
  { re: /^vertabrae/i, brand: 'Vertabrae' },
  { re: /^triple-sevens/i, brand: 'Triple Sevens' },
  { re: /^saint-michael/i, brand: 'Saint Michael' },
  { re: /^mannahatta-nyc/i, brand: 'Mannahatta NYC' },
  { re: /^bearbrick/i, brand: 'Bearbrick' },
  { re: /^salomon/i, brand: 'Salomon' },
  { re: /^bottega-desires/i, brand: 'Bottega Desires' },
];

const APPAREL_SUB_KEYWORDS: Array<{ re: RegExp; sub: string }> = [
  { re: /hoodie|sweatshirt|jacket|windrunner|nuptse/i, sub: 'outerwear' },
  { re: /boxer|brief|thermal|sock|underwear/i, sub: 'undergarments' },
  { re: /tee|t-shirt|shirt|jersey|polo|rugby|top/i, sub: 'tops' },
  { re: /short|sweatpant|pant|trouser|legging/i, sub: 'bottoms' },
];
const ACCESSORY_SUB_KEYWORDS: Array<{ re: RegExp; sub: string }> = [
  { re: /backpack|tote-bag|shoulder-bag|snat-bag|\bbag\b/i, sub: 'bags' },
  { re: /\bbelt\b/i, sub: 'belts' },
  { re: /glasses|sunglasses|eyewear/i, sub: 'eyewear' },
  { re: /trucker|snapback|beanie|\bcap\b|\bhat\b|headwear/i, sub: 'headwear' },
  { re: /ring|pendant|necklace|jewelry|jewellery/i, sub: 'jewelry' },
  { re: /wallet|money-clip|card-holder/i, sub: 'wallets-card-holders' },
  { re: /\bwatch\b/i, sub: 'watches' },
  { re: /keychain|lanyard/i, sub: 'lanyards-keychains' },
];

const COLOR_WORDS: Record<string, string> = {
  black: 'black', white: 'white', multi: 'multi', multicolor: 'multi',
  blue: 'blue', grey: 'grey', gray: 'grey', red: 'red', yellow: 'yellow',
  brown: 'brown', pink: 'pink', purple: 'purple', green: 'green', orange: 'orange',
  silver: 'silver',
};

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isOpaqueHashName(nameNoExt: string): boolean {
  const withoutTrailingIndex = nameNoExt.replace(/-\d{1,2}-?$/, '');
  const hasUuidTail = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(withoutTrailingIndex);
  const hasUpperCaseWord = /[A-Z]/.test(withoutTrailingIndex);
  return hasUuidTail || !hasUpperCaseWord;
}

function computeGroupKey(nameNoExt: string): string {
  let key = nameNoExt;
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of [/-\d{1,2}-$/, /-\d{1,2}$/, /-[0-9a-f]{8}$/i, /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, /-Product$/i]) {
      const next = key.replace(re, '');
      if (next !== key) { key = next; changed = true; break; }
    }
  }
  return key;
}

function detectBrand(nameNoExt: string): { brand: string | null; isCollab: boolean; matchText: string | null } {
  const segments = nameNoExt.split(/-x-/i);
  const isCollab = segments.length > 1;
  for (const seg of segments) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(seg));
    if (match) return { brand: match.brand, isCollab, matchText: nameNoExt.match(match.re)?.[0] ?? null };
  }
  const wholeMatch = BRAND_PATTERNS.find((p) => p.re.test(nameNoExt));
  return { brand: wholeMatch ? wholeMatch.brand : null, isCollab, matchText: wholeMatch ? nameNoExt.match(wholeMatch.re)?.[0] ?? null : null };
}

function detectColor(nameNoExt: string): string | null {
  const tokens = nameNoExt.toLowerCase().split(/[-\s]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (COLOR_WORDS[tokens[i]]) return COLOR_WORDS[tokens[i]];
  }
  return null;
}

function detectGenderAge(nameNoExt: string): { gender: string | null; ageGroup: string | null } {
  if (/-GS$/i.test(nameNoExt) || /-GS-/i.test(nameNoExt)) return { gender: 'kids', ageGroup: 'child' };
  if (/-PS$/i.test(nameNoExt) || /-PS-/i.test(nameNoExt)) return { gender: 'kids', ageGroup: 'preschool' };
  if (/-TD$/i.test(nameNoExt)) return { gender: 'kids', ageGroup: 'toddler' };
  if (/-W$/i.test(nameNoExt) || /-Womens?-/i.test(nameNoExt) || /-Womens?$/i.test(nameNoExt)) return { gender: 'women', ageGroup: null };
  return { gender: null, ageGroup: null };
}

function classifyApparelSub(nameNoExt: string): string {
  const hit = APPAREL_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
  return hit ? hit.sub : 'other-apparel';
}
function classifyAccessorySub(nameNoExt: string): string {
  const hit = ACCESSORY_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
  return hit ? hit.sub : 'other-accessories';
}
function inferCategoryFromName(nameNoExt: string): 'sneakers' | 'apparel' | 'accessories' | null {
  if (ACCESSORY_KEYWORDS.test(nameNoExt)) return 'accessories';
  if (APPAREL_KEYWORDS.test(nameNoExt)) return 'apparel';
  if (SNEAKER_KEYWORDS.test(nameNoExt)) return 'sneakers';
  return null;
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

interface FileEntry {
  full: string;
  rel: string;
  filename: string;
  ext: string;
  nameNoExt: string;
  contentHash: string;
  topCategory: 'sneakers' | 'apparel' | 'accessories' | null;
}

interface ProductGroup {
  brand: string;
  groupKey: string;
  category: 'sneakers' | 'apparel' | 'accessories';
  files: FileEntry[];
  isCollab: boolean;
  isMattyBoyStandalone: boolean;
}

async function main() {
  const rawFiles: string[] = [];
  walk(IMAGES_ROOT, rawFiles);
  const homeRawFiles: string[] = [];
  walk(HOME_PRODUCTS_ROOT, homeRawFiles);

  const seenHashes = new Set<string>();
  const groups = new Map<string, ProductGroup>();
  let opaqueSkipped = 0;
  let duplicateSkipped = 0;
  let noCategorySkipped = 0;
  const noCategoryFiles: string[] = [];

  function ingest(full: string, rootDir: string, isHome: boolean) {
    const relFromRoot = relative(rootDir, full);
    const parts = relFromRoot.split('/');
    const folder = parts[0];
    const filename = parts[parts.length - 1];
    const ext = extname(filename).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return;
    if (isHome && EXCLUDED_HOME_FOLDERS.has(folder)) return;

    const buffer = readFileSync(full);
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (seenHashes.has(hash)) { duplicateSkipped++; return; }
    seenHashes.add(hash);

    const nameNoExt = filename.slice(0, -ext.length);
    if (isOpaqueHashName(nameNoExt)) { opaqueSkipped++; return; }

    const isMattyBoyStandalone = /^Matty-Boy-/i.test(nameNoExt);
    const detected = isMattyBoyStandalone
      ? { brand: 'Chrome Hearts', isCollab: true, matchText: null as string | null }
      : detectBrand(nameNoExt);

    if (!detected.brand) return; // sem marca reconhecida: fica de fora (não força nada)

    let category = isHome ? HOME_FOLDER_CATEGORY[folder] : IMAGES_FOLDER_CATEGORY[folder];
    if (!category) category = inferCategoryFromName(nameNoExt) ?? undefined as never;
    if (!category) { noCategorySkipped++; noCategoryFiles.push(relative(PUBLIC_ROOT, full)); return; }

    let groupKey = computeGroupKey(nameNoExt);
    if (isMattyBoyStandalone) groupKey = `x-Matty-Boy-${groupKey.replace(/^Matty-Boy-/i, '')}`;

    const rel = relative(PUBLIC_ROOT, full);
    const entry: FileEntry = { full, rel, filename, ext, nameNoExt, contentHash: hash, topCategory: category };

    const mapKey = `${detected.brand}::${groupKey}`;
    let group = groups.get(mapKey);
    if (!group) {
      group = { brand: detected.brand, groupKey, category, files: [], isCollab: detected.isCollab, isMattyBoyStandalone };
      groups.set(mapKey, group);
    }
    group.files.push(entry);
  }

  for (const f of rawFiles) ingest(f, IMAGES_ROOT, false);
  for (const f of homeRawFiles) ingest(f, HOME_PRODUCTS_ROOT, true);

  console.log(`Grupos (produtos) formados: ${groups.size}`);
  console.log(`Arquivos opacos (sem info) pulados: ${opaqueSkipped}`);
  console.log(`Arquivos duplicados por conteúdo pulados: ${duplicateSkipped}`);
  console.log(`Descritivos sem categoria inferível, pulados: ${noCategorySkipped}`, noCategoryFiles);

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

  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();
  const report: Array<Record<string, unknown>> = [];
  let created = 0, imagesUploaded = 0, imageFailures = 0, imagesSkippedByGuard = 0, skipped = 0, errors = 0;

  for (const group of groups.values()) {
    const brandId = brandBySlug.get(slugify(group.brand));
    if (!brandId) {
      report.push({ group: group.groupKey, status: 'skipped', reason: `brand not found in DB: ${group.brand} — rode SQL_BRANDS_SEED_LUXURY_DROP.sql primeiro` });
      skipped++;
      continue;
    }

    const primaryFile = group.files[0];

    let categoryRow;
    if (group.category === 'sneakers') {
      categoryRow = categoryBySlug.get('sneakers');
    } else if (group.category === 'apparel') {
      categoryRow = categoryBySlug.get(classifyApparelSub(group.groupKey));
    } else {
      categoryRow = categoryBySlug.get(classifyAccessorySub(group.groupKey));
    }
    if (!categoryRow) {
      report.push({ group: group.groupKey, status: 'skipped', reason: `category not resolved for ${group.category}` });
      skipped++;
      continue;
    }

    const nameGuess = (
      group.isCollab
        ? group.groupKey.replace(/-x-/gi, ' x ').replace(/-/g, ' ')
        : group.groupKey.replace(new RegExp(`^${group.brand.replace(/ /g, '-')}-?`, 'i'), '').replace(/-/g, ' ')
    ).trim() || group.groupKey.replace(/-/g, ' ').trim();

    const colorValue = detectColor(group.groupKey);
    const colorFvId = colorValue ? findFacetValueId('color', colorValue) : undefined;
    const { gender, ageGroup } = detectGenderAge(group.groupKey);
    const genderFvId = gender ? findFacetValueId('gender', gender) : undefined;
    const ageGroupFvId = ageGroup ? findFacetValueId('age_group', ageGroup) : undefined;

    let baseSlug = slugify(`${group.brand}-${nameGuess}`);
    let slug = baseSlug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const buffer = readFileSync(primaryFile.full);
    const contentHash8 = createHash('sha256').update(buffer).digest('hex').slice(0, 8).toUpperCase();
    let sku = `DEV-${contentHash8}-STD`;
    let skuN = 2;
    while (usedSkus.has(sku)) sku = `DEV-${contentHash8}-STD${skuN++}`;
    usedSkus.add(sku);

    const variants = [{
      sku,
      price: PLACEHOLDER_PRICE,
      stockQuantity: PLACEHOLDER_STOCK,
      facetValueIds: colorFvId ? [colorFvId] : [],
    }];

    const productFacetValueIds = [genderFvId, ageGroupFvId].filter((v): v is string => !!v);

    const nameStartsWithBrand = nameGuess.toLowerCase().startsWith(group.brand.toLowerCase());
    const description = nameStartsWithBrand ? `${nameGuess}.` : `${group.brand} ${nameGuess}.`;

    try {
      const product = await productsService.create({
        categoryId: categoryRow.id,
        brandId,
        name: nameGuess,
        slug,
        description,
        status: product_status.draft,
        featured: false,
        variants,
        facetValueIds: productFacetValueIds,
      } as Parameters<typeof productsService.create>[0]);

      created++;

      if (process.env.ALLOW_IMAGE_UPLOAD !== '1') {
        imagesSkippedByGuard += group.files.length;
        report.push({
          group: group.groupKey, status: 'image_upload_skipped', productId: product.id, slug,
          category: categoryRow.slug, brand: group.brand, imageCount: group.files.length,
          files: group.files.map((f) => f.rel),
          reason: 'ALLOW_IMAGE_UPLOAD not set to 1',
        });
      } else {
        let uploadedForThisProduct = 0;
        const failedFiles: string[] = [];
        for (const f of group.files) {
          try {
            const fileBuffer = readFileSync(f.full);
            const mimetype = f.ext === '.png' ? 'image/png' : f.ext === '.webp' ? 'image/webp' : 'image/jpeg';
            const fakeFile = {
              buffer: fileBuffer, originalname: f.filename, mimetype, fieldname: 'files', encoding: '7bit', size: fileBuffer.length,
            } as Express.Multer.File;
            await productsService.addImages(product.id, [fakeFile]);
            uploadedForThisProduct++;
            imagesUploaded++;
          } catch (imgErr) {
            imageFailures++;
            failedFiles.push(f.rel);
          }
        }
        report.push({
          group: group.groupKey, status: 'created', productId: product.id, slug,
          category: categoryRow.slug, brand: group.brand,
          imagesUploaded: uploadedForThisProduct, imagesFailed: failedFiles,
        });
      }
    } catch (err) {
      errors++;
      report.push({ group: group.groupKey, status: 'error', brand: group.brand, error: err instanceof Error ? err.message : String(err) });
    }
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n=== Resumo ===');
  console.log(`Produtos criados: ${created}`);
  console.log(`Imagens enviadas: ${imagesUploaded} | Falha de imagem: ${imageFailures} | Puladas pela trava ALLOW_IMAGE_UPLOAD: ${imagesSkippedByGuard}`);
  console.log(`Pulados (marca/categoria não resolvida): ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Relatório completo: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
