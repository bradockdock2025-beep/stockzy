/**
 * Trata os dados brutos de STORAGES/: descarta lixo de página salva, deduplica por
 * hash de conteúdo, faz parsing do nome de arquivo (marca/colorway/gênero/idade) e
 * classifica categoria/subcategoria. Não toca no banco nem faz upload — só lê
 * STORAGES/ e escreve o manifesto organizado (JSON + CSV de revisão).
 *
 * Uso: npx ts-node -T scripts/organize-storages.ts
 */
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';

const ROOT = join(__dirname, '..', 'STORAGES');
const OUT_JSON = join(__dirname, '..', 'STORAGES_MANIFEST.json');
const OUT_CSV = join(__dirname, '..', 'STORAGES_MANIFEST_REVIEW.csv');

const JUNK_NAMES = new Set(['.ds_store']);
const JUNK_EXT = new Set(['.svg', '.css']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

type Gender = 'men' | 'women' | 'kids' | 'unisex';
type AgeGroup = 'child' | 'preschool';

interface FolderContext {
  category?: string;
  subcategory?: string;
  brandHint?: string;
  gender?: Gender;
}

// Mapeamento pasta -> contexto, conforme PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md secao 4
const FOLDER_CONTEXT: Record<string, FolderContext> = {
  'brands-nike?category=sneakers=product-line=nike-air-max_files': { category: 'sneakers', brandHint: 'Nike' },
  'brands=jordan-category=sneakers&model=1': { category: 'sneakers', brandHint: 'Jordan' },
  'brands=jordan=category=sneakers&model=3_files': { category: 'sneakers', brandHint: 'Jordan' },
  'brands=new-balance=category=sneakers&model=2002r_files': { category: 'sneakers', brandHint: 'New Balance' },
  'brands=nike?category=sneakers=model=air-force-1_files': { category: 'sneakers', brandHint: 'Nike' },
  'brands=yeezy?category=sneakers_files': { category: 'sneakers', brandHint: 'Yeezy' },
  'brands=asics=category=sneakers&gender=men_files': { category: 'sneakers', brandHint: 'ASICS', gender: 'men' },
  'brands:swatch_files': { category: 'accessories', subcategory: 'watches', brandHint: 'Swatch' },
  'browse=kids_files': { gender: 'kids' },
  'browse=women_files': { gender: 'women' },
  'category=sneakers_files': { category: 'sneakers' },
  'category=shoes_files': { category: 'shoes' },
  'category=apparel_files': { category: 'apparel' },
  'category=accessories=bags=backpacks_files': { category: 'accessories', subcategory: 'bags' },
};

// Ordem importa: padrões mais específicos primeiro
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
  { re: /^361-?degrees/i, brand: '361 Degrees' },
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
];

const KNOWN_COLLAB_NAMES = ['Travis Scott', 'FC Barcelona', 'Omega', 'Audemars Piguet', 'VAA', 'Jacquemus'];

const COLOR_WORDS: Record<string, string> = {
  black: 'black',
  white: 'white',
  multi: 'multi',
  multicolor: 'multi',
  blue: 'blue',
  grey: 'grey',
  gray: 'grey',
  red: 'red',
  yellow: 'yellow',
  brown: 'brown',
  pink: 'pink',
  purple: 'purple',
  green: 'green',
  orange: 'orange',
};

const APPAREL_SUB_KEYWORDS: Array<{ re: RegExp; sub: string }> = [
  { re: /hoodie|sweatshirt|windrunner|jacket|nuptse/i, sub: 'outerwear' },
  { re: /short|sweatpant|pant|legging/i, sub: 'bottoms' },
  { re: /boxer|brief|thermal|sock|underwear/i, sub: 'undergarments' },
  { re: /tee|t-shirt|shirt|jersey|polo|top/i, sub: 'tops' },
];

const SHOES_SUB_KEYWORDS: Array<{ re: RegExp; sub: string }> = [
  { re: /slide|sandal/i, sub: 'slides-sandals' },
  { re: /clog/i, sub: 'clogs' },
  { re: /cleat/i, sub: 'cleats' },
  { re: /boot/i, sub: 'boots' },
  { re: /loafer/i, sub: 'loafers' },
  { re: /slipper/i, sub: 'slippers' },
  { re: /heel/i, sub: 'heels' },
  { re: /oxford/i, sub: 'oxfords' },
  { re: /flat/i, sub: 'flats' },
  { re: /spike/i, sub: 'spikes' },
];

const ACCESSORY_KEYWORDS = /backpack|bag|watch|wallet|belt|cap|beanie|glasses|eyewear|jewelry|keychain|lanyard/i;
const APPAREL_KEYWORDS = /hoodie|sweatshirt|jersey|tee|t-shirt|shirt|short|pant|jacket|polo|sock|boxer|brief/i;

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
  categoryConfidence: 'folder' | 'keyword' | 'inferred' | 'unknown';
  gender: Gender | null;
  genderConfidence: 'detected' | 'folder_default' | 'assumed';
  ageGroup: AgeGroup | null;
  colorFacetGuess: string | null;
  needsReview: boolean;
  reviewReasons: string[];
}

function walk(dir: string, base: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, base, out);
    } else {
      out.push(full);
    }
  }
}

function stripSuffixes(nameNoExt: string): string {
  return nameNoExt
    .replace(/-Product$/i, '')
    .replace(/_V\d+$/i, '')
    .replace(/-[Vv]\d+$/i, '')
    .replace(/-\d+$/i, '')
    .replace(/-Product$/i, '');
}

function detectGenderAndAge(nameNoExt: string): { gender: Gender | null; ageGroup: AgeGroup | null } {
  if (/-GS$/i.test(nameNoExt) || /-GS-/i.test(nameNoExt)) return { gender: 'kids', ageGroup: 'child' };
  if (/-PS$/i.test(nameNoExt) || /-PS-/i.test(nameNoExt)) return { gender: 'kids', ageGroup: 'preschool' };
  if (/-TD$/i.test(nameNoExt)) return { gender: 'kids', ageGroup: null };
  if (/-W$/i.test(nameNoExt) || /-Womens?-/i.test(nameNoExt) || /-Womens?$/i.test(nameNoExt)) {
    return { gender: 'women', ageGroup: null };
  }
  return { gender: null, ageGroup: null };
}

function detectBrandAndCollab(nameNoExt: string): { brand: string | null; isCollab: boolean; collaborators: string[]; rest: string } {
  const segments = nameNoExt.split(/-x-/i);
  const isCollab = segments.length > 1;
  let brand: string | null = null;
  const collaborators: string[] = [];
  let restSegmentIndex = -1;

  segments.forEach((seg, idx) => {
    if (brand) {
      // já achou marca principal; resto vira colaborador se não for texto residual do produto
      return;
    }
    const match = BRAND_PATTERNS.find((p) => p.re.test(seg));
    if (match) {
      brand = match.brand;
      restSegmentIndex = idx;
    }
  });

  if (!isCollab) {
    const match = BRAND_PATTERNS.find((p) => p.re.test(nameNoExt));
    return { brand: match ? match.brand : null, isCollab: false, collaborators: [], rest: nameNoExt };
  }

  segments.forEach((seg, idx) => {
    if (idx === restSegmentIndex) return;
    const asWords = seg.replace(/-/g, ' ').trim();
    if (asWords) collaborators.push(asWords);
  });

  // Collab: mantém o nome inteiro (todos os segmentos, "-x-" virando " x ") como nameGuess —
  // ao contrário do caso normal, não dá pra só cortar o prefixo da marca, porque o nome do
  // produto de verdade normalmente está no segmento SEGUINTE ao da marca, não nele mesmo
  // (ex.: "Swatch-x-Omega-Bioceramic-Moonswatch..." — o produto é "Omega Bioceramic...", não "Swatch").
  const rest = nameNoExt.replace(/-x-/gi, ' x ');
  return { brand, isCollab: true, collaborators, rest };
}

function classifyCategory(
  ctx: FolderContext,
  nameNoExt: string,
): { categorySlug: string | null; subcategorySlug: string | null; confidence: ManifestEntry['categoryConfidence'] } {
  if (ctx.category === 'apparel') {
    const hit = APPAREL_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
    return { categorySlug: 'apparel', subcategorySlug: hit ? hit.sub : 'other-apparel', confidence: 'folder' };
  }
  if (ctx.category === 'shoes') {
    const hit = SHOES_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
    return { categorySlug: 'shoes', subcategorySlug: hit ? hit.sub : null, confidence: 'folder' };
  }
  if (ctx.category) {
    return { categorySlug: ctx.category, subcategorySlug: ctx.subcategory ?? null, confidence: 'folder' };
  }

  // Pastas browse=* sem categoria fixa: infere por palavra-chave
  if (ACCESSORY_KEYWORDS.test(nameNoExt)) {
    return { categorySlug: 'accessories', subcategorySlug: null, confidence: 'keyword' };
  }
  if (APPAREL_KEYWORDS.test(nameNoExt)) {
    const hit = APPAREL_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
    return { categorySlug: 'apparel', subcategorySlug: hit ? hit.sub : 'other-apparel', confidence: 'keyword' };
  }
  const shoeHit = SHOES_SUB_KEYWORDS.find((k) => k.re.test(nameNoExt));
  if (shoeHit) {
    return { categorySlug: 'shoes', subcategorySlug: shoeHit.sub, confidence: 'keyword' };
  }
  // Default: maioria dos itens em browse=kids/women das amostras é sneaker
  return { categorySlug: 'sneakers', subcategorySlug: null, confidence: 'inferred' };
}

function detectColor(nameNoExt: string): string | null {
  const tokens = nameNoExt.toLowerCase().split(/[-\s]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (COLOR_WORDS[tokens[i]]) return COLOR_WORDS[tokens[i]];
  }
  return null;
}

function main() {
  const allFiles: string[] = [];
  walk(ROOT, ROOT, allFiles);

  const seenHashes = new Map<string, string>(); // hash -> primeiro file (relative path)
  const entries: ManifestEntry[] = [];
  let junkCount = 0;

  for (const full of allFiles) {
    const rel = relative(ROOT, full);
    const filename = rel.split('/').pop()!;
    const ext = extname(filename).toLowerCase();
    const lowerName = filename.toLowerCase();

    if (JUNK_NAMES.has(lowerName) || JUNK_EXT.has(ext) || !IMAGE_EXT.has(ext)) {
      junkCount++;
      continue;
    }

    const folder = rel.split('/')[0];
    const ctx = FOLDER_CONTEXT[folder] ?? {};
    const nameNoExt = filename.slice(0, -ext.length);
    const cleanedName = stripSuffixes(nameNoExt);

    const buffer = readFileSync(full);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const isDuplicateOf = seenHashes.has(hash) ? seenHashes.get(hash)! : null;
    if (!isDuplicateOf) seenHashes.set(hash, rel);

    const detected = detectBrandAndCollab(cleanedName);
    const usedFolderHint = !detected.brand && !!ctx.brandHint;
    const brand = detected.brand ?? ctx.brandHint ?? null;
    const { isCollab, collaborators, rest } = detected;
    const { gender: genderFromName, ageGroup } = detectGenderAndAge(cleanedName);
    const category = classifyCategory(ctx, cleanedName);
    const colorFacetGuess = detectColor(cleanedName);

    let gender: Gender | null = genderFromName ?? ctx.gender ?? null;
    let genderConfidence: ManifestEntry['genderConfidence'] = genderFromName
      ? 'detected'
      : ctx.gender
        ? 'folder_default'
        : 'assumed';
    if (!gender) {
      gender = 'men';
      genderConfidence = 'assumed';
    }

    // Collab mantém o nome inteiro (as duas marcas fazem parte do título de verdade,
    // ex.: "Swatch x Omega Bioceramic Moonswatch..."); só o caso normal corta o prefixo da marca.
    let nameGuess = (
      isCollab
        ? rest.replace(/-/g, ' ')
        : rest.replace(new RegExp(`^${(brand ?? '').replace(/ /g, '-')}-?`, 'i'), '').replace(/-/g, ' ')
    ).trim();
    // Rede de segurança: nunca deixar produto sem nome, mesmo que a extração falhe por algum caso não previsto
    let usedNameFallback = false;
    if (!nameGuess) {
      nameGuess = cleanedName.replace(/-/g, ' ').trim();
      usedNameFallback = true;
    }

    // Motivos que bloqueiam a inserção (precisam de decisão humana antes de virar Product)
    const blockingReasons: string[] = [];
    if (!brand) blockingReasons.push('brand_unmatched');
    if (category.confidence === 'inferred') blockingReasons.push('category_inferred_no_folder_signal');
    if (usedNameFallback) blockingReasons.push('name_extraction_fallback');

    // Motivos informativos, não bloqueiam (facet fica sem valor, produto entra normal)
    const infoReasons: string[] = [];
    if (usedFolderHint) infoReasons.push('brand_from_folder_hint');
    if (genderConfidence === 'assumed') infoReasons.push('gender_assumed_default_men');
    if (!colorFacetGuess) infoReasons.push('color_not_recognized');
    if (isDuplicateOf) infoReasons.push('duplicate_content');

    const reviewReasons = [...blockingReasons, ...infoReasons];

    entries.push({
      file: rel,
      folder,
      filenameRaw: filename,
      contentHash: hash,
      isDuplicateOf,
      brand,
      isCollab,
      collaborators: [...collaborators, ...KNOWN_COLLAB_NAMES.filter((c) => nameGuess.toLowerCase().includes(c.toLowerCase()))],
      nameGuess,
      categorySlug: category.categorySlug,
      subcategorySlug: category.subcategorySlug,
      categoryConfidence: category.confidence,
      gender,
      genderConfidence,
      ageGroup,
      colorFacetGuess,
      needsReview: blockingReasons.length > 0,
      reviewReasons,
    });
  }

  writeFileSync(OUT_JSON, JSON.stringify(entries, null, 2));

  const reviewRows = entries.filter((e) => e.needsReview);
  const csvHeader = 'file,brand,nameGuess,categorySlug,subcategorySlug,gender,colorFacetGuess,reviewReasons\n';
  const csvBody = reviewRows
    .map((e) =>
      [e.file, e.brand ?? '', e.nameGuess, e.categorySlug ?? '', e.subcategorySlug ?? '', e.gender ?? '', e.colorFacetGuess ?? '', e.reviewReasons.join('|')]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  writeFileSync(OUT_CSV, csvHeader + csvBody);

  const duplicates = entries.filter((e) => e.isDuplicateOf).length;
  const unique = entries.length - duplicates;
  const byBrandUnmatched = entries.filter((e) => !e.brand).length;
  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    const key = e.categorySlug ?? 'null';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log('=== Resumo do tratamento ===');
  console.log(`Arquivos de imagem processados: ${entries.length}`);
  console.log(`Lixo descartado (.DS_Store/.svg/.css): ${junkCount}`);
  console.log(`Únicos por conteúdo: ${unique} | Duplicados: ${duplicates}`);
  console.log(`Marca não reconhecida: ${byBrandUnmatched}`);
  console.log('Por categoria:', byCategory);
  console.log(`Itens sinalizados para revisão (reviewReasons != so duplicate): ${entries.filter((e) => e.needsReview).length}`);
  console.log(`\nManifesto completo: ${OUT_JSON}`);
  console.log(`CSV de revisão: ${OUT_CSV}`);
}

main();
