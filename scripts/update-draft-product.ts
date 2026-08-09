import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const product = await prisma.product.findFirst({
    where: { status: 'draft' },
    include: { variants: true },
  });

  if (!product) {
    console.log('Nenhum produto em draft encontrado.');
    return;
  }

  console.log(`Produto: ${product.name}`);
  console.log(`ID produto: ${product.id}`);
  console.log(`Variantes: ${product.variants.length}`);

  await prisma.product.update({
    where: { id: product.id },
    data: { status: 'active' },
  });

  for (const variant of product.variants) {
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { price: 1.20, compareAtPrice: null },
    });
    console.log(`  Variante "${variant.title}" (${variant.sku}): preço → €1.20`);
  }

  console.log(`\nStatus: draft → active`);
  console.log(`Produto pronto para teste de compra.`);
  console.log(`\nID variante para teste: ${product.variants[0]?.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
