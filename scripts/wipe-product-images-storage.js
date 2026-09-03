// Apaga TODOS os arquivos do bucket de imagens de produto no Supabase Storage,
// como parte da limpeza total do catálogo (ver SQL_CHECK_PRODUCTS_WIPE.sql e
// SQL_WIPE_ALL_PRODUCTS_AND_IMAGES.sql, que cuidam das linhas no banco).
//
// Todo upload de imagem de produto (ProductsService.addImages) grava no caminho
// `products/<productId>/product/<file>` ou `products/<productId>/variant-<variantId>/<file>`,
// então basta varrer recursivamente o prefixo `products/` no bucket e remover tudo.
//
// Roda com: node scripts/wipe-product-images-storage.js
// Use --dry-run pra só listar o que seria apagado, sem apagar nada.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT_PREFIX = 'products';
const LIST_PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || 'product-images';

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar setados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Storage do Supabase não tem pastas de verdade — list() lista um "nível" por vez.
// Um item sem `.id` (ou sem metadata) é uma "pasta" (prefixo); com `.id` é um arquivo.
async function listAllFiles(prefix) {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      throw new Error(`Falha ao listar "${prefix}": ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id === null;
      if (isFolder) {
        const nested = await listAllFiles(fullPath);
        files.push(...nested);
      } else {
        files.push(fullPath);
      }
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return files;
}

async function main() {
  console.log(`Bucket: ${bucket} | prefixo: ${ROOT_PREFIX}/ | dry-run: ${DRY_RUN}`);

  const allFiles = await listAllFiles(ROOT_PREFIX);

  if (allFiles.length === 0) {
    console.log('Nenhum arquivo encontrado sob esse prefixo. Nada a apagar.');
    return;
  }

  console.log(`Encontrados ${allFiles.length} arquivo(s) sob "${ROOT_PREFIX}/".`);

  if (DRY_RUN) {
    allFiles.forEach((f) => console.log(`  [dry-run] ${f}`));
    console.log(`\n${allFiles.length} arquivo(s) seriam apagados. Rode sem --dry-run para apagar de verdade.`);
    return;
  }

  let removed = 0;
  for (let i = 0; i < allFiles.length; i += REMOVE_BATCH_SIZE) {
    const batch = allFiles.slice(i, i + REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      throw new Error(`Falha ao apagar lote começando em "${batch[0]}": ${error.message}`);
    }
    removed += batch.length;
    console.log(`  ✓ ${removed}/${allFiles.length} apagados`);
  }

  console.log(`\nConcluído: ${removed} arquivo(s) apagados do bucket "${bucket}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
