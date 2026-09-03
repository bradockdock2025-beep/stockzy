/**
 * Análise (SOMENTE LEITURA) de frontend/public/images/{sneakers,apparel,accessories}
 * + frontend/public/home-products/ antes do novo insert em massa de Product Items.
 * Não toca no banco, não apaga nem move nenhum arquivo — só lê e escreve um
 * manifesto JSON + CSV de revisão, no mesmo padrão de scripts/organize-storages.ts.
 *
 * Uso: npx ts-node -T scripts/analyze-public-product-images.ts
 */
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';

const PUBLIC_ROOT = join(__dirname, '..', 'frontend', 'public');
const IMAGES_ROOT = join(PUBLIC_ROOT, 'images');
const HOME_PRODUCTS_ROOT = join(PUBLIC_ROOT, 'home-products');
const OUT_JSON = join(__dirname, '..', 'PUBLIC_IMAGES_MANIFEST.json');
const OUT_CSV = join(__dirname, '..', 'PUBLIC_IMAGES_MANIFEST_REVIEW.csv');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// home-products/about é banner de seção institucional, não produto — fora do escopo.
const EXCLUDED_HOME_FOLDERS = new Set(['about']);

// pasta de topo (dentro de images/) -> categoria (bate com as categorias raiz do banco real)
const IMAGES_FOLDER_CATEGORY: Record<string, string> = {
  sneakers: 'sneakers',
  apparel: 'apparel',
  accessories: 'accessories',
};

// pastas home-products/new-arrivals-* já declaram a categoria no próprio nome
const HOME_FOLDER_CATEGORY: Record<string, string> = {
  'new-arrivals-sneakers': 'sneakers',
  'new-arrivals-apparel': 'apparel',
  'new-arrivals-accessories': 'accessories',
};

const APPAREL_KEYWORDS = /hoodie|sweatshirt|jersey|tee|t-shirt|shirt|short|pant|jacket|polo|sock|boxer|brief|trouser/i;
const ACCESSORY_KEYWORDS = /backpack|bag|watch|wallet|belt|cap|beanie|hat|glasses|eyewear|jewelry|keychain|lanyard|ring|pendant|figurine|bearbrick/i;
const SNEAKER_KEYWORDS = /sneaker|dunk|jordan|yeezy|air-force|air-max|replica|b30|gel-|2002r/i;

// Marcas já confirmadas na tabela brands do banco real (SELECT name FROM brands, 2026-08-21)
const KNOWN_LIVE_BRANDS = new Set([
  '361 Degrees','adidas','Aime Leon Dore','Alexander McQueen','Altra','AMIRI','Anta',
  'Anti Social Social Club',"Arc'teryx",'ASICS','Atmos','Autry','Awake','Axel Arigato',
  'Balenciaga','BAPE','Billionaire Boys Club','Birkenstock','Bottega Veneta','Brain Dead',
  'Bravest Studios','Crocs','Eric Emanuel','Fear of God Essentials','Godspeed','Gymshark',
  'Hellstar','Jordan','Kith','Louis Vuitton','Maison MIHARA YASUHIRO','New Balance','Nike',
  'Onitsuka Tiger','Palace','Puma','Saint Laurent','Sprayground','Supreme','Swatch',
  'The North Face','Timberland','UGG','Yeezy',
  'Apple','Canon','finalmouse','Fujifilm','Meta','Microsoft','Nintendo','NVIDIA','Odyssey',
  'Selkirk','Sony','Spalding','Stanley','Teenage Engineering','Valve',
]);

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
  { re: /^matty-boy/i, brand: 'Matty Boy' },
];

interface ManifestEntry {
  file: string;
  root: 'images' | 'home-products';
  folder: string;
  filenameRaw: string;
  ext: string;
  contentHash: string;
  isDuplicateOf: string | null;
  isOpaqueHash: boolean;
  groupKey: string | null;
  brand: string | null;
  brandIsNew: boolean;
  isCollab: boolean;
  nameGuess: string | null;
  categorySlug: string | null;
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
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
    const withoutIndexInfix = key.replace(/-\d{1,2}-$/, '');
    if (withoutIndexInfix !== key) { key = withoutIndexInfix; changed = true; continue; }
    const withoutIndexSuffix = key.replace(/-\d{1,2}$/, '');
    if (withoutIndexSuffix !== key) { key = withoutIndexSuffix; changed = true; continue; }
    const withoutHash = key.replace(/-[0-9a-f]{8}$/i, '');
    if (withoutHash !== key) { key = withoutHash; changed = true; continue; }
    const withoutUuid = key.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '');
    if (withoutUuid !== key) { key = withoutUuid; changed = true; continue; }
    const withoutProduct = key.replace(/-Product$/i, '');
    if (withoutProduct !== key) { key = withoutProduct; changed = true; continue; }
  }
  return key;
}

function detectBrand(nameNoExt: string): { brand: string | null; isCollab: boolean } {
  const segments = nameNoExt.split(/-x-/i);
  const isCollab = segments.length > 1;
  for (const seg of segments) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(seg));
    if (match) return { brand: match.brand, isCollab };
  }
  const wholeMatch = BRAND_PATTERNS.find((p) => p.re.test(nameNoExt));
  return { brand: wholeMatch ? wholeMatch.brand : null, isCollab };
}

function inferCategoryFromName(nameNoExt: string): string | null {
  if (ACCESSORY_KEYWORDS.test(nameNoExt)) return 'accessories';
  if (APPAREL_KEYWORDS.test(nameNoExt)) return 'apparel';
  if (SNEAKER_KEYWORDS.test(nameNoExt)) return 'sneakers';
  return null;
}

function main() {
  const imageFiles: string[] = [];
  walk(IMAGES_ROOT, imageFiles);
  const homeFiles: string[] = [];
  walk(HOME_PRODUCTS_ROOT, homeFiles);

  const entries: ManifestEntry[] = [];
  const seenHashes = new Map<string, string>(); // hash -> primeiro file (relative ao PUBLIC_ROOT)

  function processFile(full: string, root: 'images' | 'home-products', rootDir: string) {
    const rel = relative(PUBLIC_ROOT, full);
    const relFromRoot = relative(rootDir, full);
    const parts = relFromRoot.split('/');
    const folder = parts[0];
    const filename = parts[parts.length - 1];
    const ext = extname(filename).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return;
    if (root === 'home-products' && EXCLUDED_HOME_FOLDERS.has(folder)) return;

    const buffer = readFileSync(full);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const isDuplicateOf = seenHashes.has(hash) ? seenHashes.get(hash)! : null;
    if (!isDuplicateOf) seenHashes.set(hash, rel);

    let categorySlug: string | null =
      root === 'images' ? IMAGES_FOLDER_CATEGORY[folder] ?? null : HOME_FOLDER_CATEGORY[folder] ?? null;

    const nameNoExt = filename.slice(0, -ext.length);
    const opaque = isOpaqueHashName(nameNoExt);

    let brand: string | null = null;
    let isCollab = false;
    let groupKey: string | null = null;
    let nameGuess: string | null = null;

    if (!opaque) {
      const detected = detectBrand(nameNoExt);
      brand = detected.brand;
      isCollab = detected.isCollab;
      groupKey = computeGroupKey(nameNoExt);
      nameGuess = groupKey.replace(/-x-/gi, ' x ').replace(/-/g, ' ').trim();
      if (!categorySlug) categorySlug = inferCategoryFromName(nameNoExt);
    }

    entries.push({
      file: rel,
      root,
      folder,
      filenameRaw: filename,
      ext,
      contentHash: hash,
      isDuplicateOf,
      isOpaqueHash: opaque,
      groupKey,
      brand,
      brandIsNew: brand !== null && !KNOWN_LIVE_BRANDS.has(brand),
      isCollab,
      nameGuess,
      categorySlug,
    });
  }

  for (const f of imageFiles) processFile(f, 'images', IMAGES_ROOT);
  for (const f of homeFiles) processFile(f, 'home-products', HOME_PRODUCTS_ROOT);

  writeFileSync(OUT_JSON, JSON.stringify(entries, null, 2));

  // --- Relatório resumido ---
  const totalByRoot: Record<string, number> = {};
  const opaqueByRoot: Record<string, number> = {};
  const duplicateCount = entries.filter((e) => e.isDuplicateOf).length;
  const groupsByCategory: Record<string, Set<string>> = {};
  const uncategorizedDescriptive: ManifestEntry[] = [];
  const brandCounts = new Map<string, number>();
  const newBrands = new Set<string>();

  for (const e of entries) {
    totalByRoot[e.root] = (totalByRoot[e.root] ?? 0) + 1;
    if (e.isOpaqueHash) {
      opaqueByRoot[e.root] = (opaqueByRoot[e.root] ?? 0) + 1;
      continue;
    }
    if (e.isDuplicateOf) continue; // não conta duplicado de conteúdo pra formação de produto
    const cat = e.categorySlug ?? 'SEM_CATEGORIA';
    if (cat === 'SEM_CATEGORIA') uncategorizedDescriptive.push(e);
    if (!groupsByCategory[cat]) groupsByCategory[cat] = new Set();
    groupsByCategory[cat].add(`${e.brand ?? 'UNKNOWN'}::${e.groupKey}`);
    if (e.brand) {
      brandCounts.set(e.brand, (brandCounts.get(e.brand) ?? 0) + 1);
      if (e.brandIsNew) newBrands.add(e.brand);
    }
  }

  console.log('=== Resumo — images/ + home-products/ ===');
  console.log(`Total de imagens processadas: ${entries.length}`, totalByRoot);
  console.log(`Duplicadas por CONTEÚDO (mesmo arquivo, contato mais de uma vez): ${duplicateCount}`);
  console.log('Nome OPACO/hash por root:', opaqueByRoot);
  console.log('\nProdutos distintos identificáveis por categoria (brand+nome agrupado, sem duplicados):');
  for (const [cat, set] of Object.entries(groupsByCategory)) {
    console.log(`  ${cat}: ${set.size} produtos`);
  }
  console.log(`\nArquivos descritivos sem categoria inferível: ${uncategorizedDescriptive.length}`);
  uncategorizedDescriptive.forEach((e) => console.log(`  ${e.file} (brand=${e.brand ?? '?'})`));

  console.log(`\nMarcas detectadas (contagem de imagens, sem duplicados):`);
  console.log([...brandCounts.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}: ${n}`).join('\n'));
  console.log(`\nMarcas NOVAS (fora da tabela brands do banco real): ${newBrands.size}`);
  console.log([...newBrands].sort().join(', '));

  const csvHeader = 'file,root,isOpaqueHash,isDuplicate,brand,brandIsNew,categorySlug,groupKey,nameGuess\n';
  const csvBody = entries
    .map((e) =>
      [e.file, e.root, e.isOpaqueHash, !!e.isDuplicateOf, e.brand ?? '', e.brandIsNew, e.categorySlug ?? '', e.groupKey ?? '', e.nameGuess ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  writeFileSync(OUT_CSV, csvHeader + csvBody);

  console.log(`\nManifesto completo: ${OUT_JSON}`);
  console.log(`CSV de revisão: ${OUT_CSV}`);
}

main();
