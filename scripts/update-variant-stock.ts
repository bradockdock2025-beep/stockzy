import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const PRODUCT_ID = '6ed98ce9-085d-4a82-9b10-c987e994e8a5';
const TARGET_SIZES = ['S', 'M', 'L', 'XL'];
const NEW_QUANTITY = 15;

async function main() {
  const variants = await prisma.productVariant.findMany({
    where: { productId: PRODUCT_ID },
    include: {
      attributes: { include: { attribute: true } },
      inventory: true,
    },
  });

  console.log(`Produto ${PRODUCT_ID} — ${variants.length} variante(s) encontrada(s)\n`);

  for (const variant of variants) {
    const sizeAttr = variant.attributes.find(
      (a) => TARGET_SIZES.includes(a.value.toUpperCase()),
    );
    if (!sizeAttr) continue;

    const size = sizeAttr.value.toUpperCase();
    const currentQty = variant.inventory?.stockQuantity ?? 'sem registo';

    if (variant.inventory) {
      await prisma.inventory.update({
        where: { variantId: variant.id },
        data: { stockQuantity: NEW_QUANTITY },
      });
    } else {
      await prisma.inventory.create({
        data: { variantId: variant.id, stockQuantity: NEW_QUANTITY },
      });
    }

    console.log(`  Size ${size} (SKU: ${variant.sku}) — ${currentQty} → ${NEW_QUANTITY}`);
  }

  console.log('\nQuantidades actualizadas com sucesso.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
