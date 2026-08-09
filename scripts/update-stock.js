require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STOCK_BY_SIZE = { S: 5, M: 10, L: 10, XL: 5 };

function extractSize(title) {
  for (const size of Object.keys(STOCK_BY_SIZE)) {
    if (title.endsWith(`/ ${size}`) || title === size) return size;
  }
  return null;
}

async function main() {
  const variants = await prisma.productVariant.findMany({ include: { inventory: true } });
  console.log(`Total de variantes: ${variants.length}\n`);

  let updated = 0;
  let activated = 0;
  let skipped = 0;

  for (const variant of variants) {
    if (!variant.isActive) {
      await prisma.productVariant.update({ where: { id: variant.id }, data: { isActive: true } });
      activated++;
    }

    const size = extractSize(variant.title);
    if (!size) { skipped++; continue; }

    const stock = STOCK_BY_SIZE[size];
    await prisma.inventory.upsert({
      where: { variantId: variant.id },
      update: { stockQuantity: stock, reservedQuantity: 0 },
      create: { variantId: variant.id, stockQuantity: stock, reservedQuantity: 0 },
    });

    console.log(`  ✓ "${variant.title}" → stock: ${stock}`);
    updated++;
  }

  console.log(`\nConcluído:`);
  console.log(`  ${updated} inventários atualizados (S=5, M=10, L=10, XL=5)`);
  console.log(`  ${activated} variantes reativadas (isActive: true)`);
  console.log(`  ${skipped} variantes sem size S/M/L/XL`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
