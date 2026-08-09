require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const PRODUCT_ID = '43e5df31-3fe4-4eb8-8d7f-75fbdad1aaca';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const variants = await prisma.productVariant.findMany({
    where: { productId: PRODUCT_ID },
    include: { inventory: true },
  });

  if (variants.length === 0) {
    console.log(`Nenhuma variante encontrada para o produto ${PRODUCT_ID}`);
    return;
  }

  console.log(`Produto: ${PRODUCT_ID}`);
  console.log(`Variantes encontradas: ${variants.length}\n`);

  for (const variant of variants) {
    const antes = variant.inventory?.stockQuantity ?? 'sem registo';
    await prisma.inventory.upsert({
      where: { variantId: variant.id },
      update: { stockQuantity: 0, reservedQuantity: 0 },
      create: { variantId: variant.id, stockQuantity: 0, reservedQuantity: 0 },
    });
    console.log(`  ✓ SKU: ${variant.sku} | "${variant.title}" | stock: ${antes} → 0`);
  }

  console.log(`\nConcluído: ${variants.length} variantes zeradas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
