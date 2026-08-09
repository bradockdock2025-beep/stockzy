require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PRODUCT_IDS = [
  '4ad44a53-949c-482f-8935-fca1d1f9037b',
  'd0cbb799-f39c-478c-b0c3-91c8cfe2689a',
  '43e5df31-3fe4-4eb8-8d7f-75fbdad1aaca',
];

async function main() {
  for (const productId of PRODUCT_IDS) {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      include: { inventory: true },
      orderBy: { sku: 'asc' },
    });
    console.log(`\nProduto: ${productId}`);
    for (const v of variants) {
      const stock = v.inventory?.stockQuantity ?? 'SEM INVENTÁRIO';
      const reserved = v.inventory?.reservedQuantity ?? '-';
      console.log(`  ${v.sku} | ${v.title} | stock: ${stock} | reserved: ${reserved}`);
    }
  }
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
