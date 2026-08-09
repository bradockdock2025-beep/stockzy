/**
 * Gera SQL de vínculo de imagem (product_images) pra quando a imagem foi subida
 * MANUALMENTE no bucket do Supabase (painel web), não via script. Assume que cada
 * arquivo de STORAGES_SAMPLE_UPLOAD/ foi subido pro bucket com o MESMO nome de
 * arquivo, direto na raiz do bucket (sem subpasta) — a URL pública é previsível
 * nesse caso, não precisa consultar o Supabase pra saber o caminho.
 *
 * Roda DEPOIS de SQL_PRODUCTS_SEED.sql (product_id precisa já existir) e DEPOIS
 * de você confirmar que o upload manual terminou.
 *
 * Uso: SEED_SAMPLE_PER_GROUP=2 npx ts-node -T scripts/generate-product-images-sql.ts
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ManifestEntry {
  file: string;
  contentHash: string;
  isDuplicateOf: string | null;
  categorySlug: string | null;
  subcategorySlug: string | null;
  gender: string | null;
  ageGroup: string | null;
}

const MANIFEST_PATH = join(__dirname, '..', 'STORAGES_MANIFEST.json');
const OUT_PATH = join(__dirname, '..', 'SQL_PRODUCT_IMAGES_SEED.sql');

const SUPABASE_URL = 'https://jmenpbpgbhepfudjrnct.supabase.co';
const BUCKET = 'product-images';

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  bytes[12] = '4';
  bytes[16] = '89ab'[parseInt(bytes[16], 16) % 4];
  const hex = bytes.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

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

  const lines: string[] = [
    '-- Gerado por scripts/generate-product-images-sql.ts',
    '-- Assume upload MANUAL no bucket product-images, na raiz, com o nome de arquivo',
    '-- original preservado (mesmos arquivos de STORAGES_SAMPLE_UPLOAD/).',
    '-- Roda DEPOIS de SQL_PRODUCTS_SEED.sql e DEPOIS do upload manual terminar.',
    '-- Idempotente por product_id+url (ON CONFLICT DO NOTHING numa constraint auxiliar',
    '-- não existe no schema original — aqui evitamos duplicata checando via NOT EXISTS).',
    '',
    'BEGIN;',
    '',
  ];

  let count = 0;
  for (const entry of unique) {
    const productId = deterministicUuid(`product:${entry.contentHash}`);
    const filename = entry.file.split('/').pop()!;
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}`;

    lines.push(
      `INSERT INTO product_images (id, product_id, url, position, created_at, updated_at) ` +
        `SELECT gen_random_uuid(), '${productId}', '${esc(url)}', 0, now(), now() ` +
        `WHERE EXISTS (SELECT 1 FROM products WHERE id = '${productId}') ` +
        `AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = '${productId}' AND url = '${esc(url)}');`,
    );
    count++;
  }

  lines.push('', 'COMMIT;');
  writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`Linhas de vínculo geradas: ${count}`);
  console.log(`Arquivo: ${OUT_PATH}`);
}

main();
