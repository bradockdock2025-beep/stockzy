/**
 * Sobe as imagens pros 119 produtos HYP Sweatpants já criados por
 * scripts/seed-sweatpants-hyp.ts (rodado sem ALLOW_IMAGE_UPLOAD=1 primeiro, de
 * propósito). Lê SEED_SWEATPANTS_HYP_REPORT.json — cada entrada com status
 * 'image_upload_skipped' tem productId + a lista de arquivos (nomes relativos a
 * Streetpaints_files/).
 *
 * Uso: NODE_ENV=development npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' -r tsconfig-paths/register scripts/upload-images-for-sweatpants-hyp.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { ProductsModule } from '../src/modules/products/products.module';
import { ProductsService } from '../src/modules/products/products.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), ProductsModule] })
class UploadBootstrapModule {}

const IMAGES_DIR = join(
  '/Users/macbookpro/Documents/ECOMERCY-PROJECTS/ECO-IDEIA/BANZELO-PICS/BAZELO-WORKS/ProjetBanzylo',
  'Streetpaints_files',
);
const REPORT_PATH = join(__dirname, '..', 'SEED_SWEATPANTS_HYP_REPORT.json');

interface ReportEntry {
  source_id: number;
  status: string;
  productId?: string;
  slug?: string;
  brand?: string;
  imageCount?: number;
  files?: string[];
}

async function main() {
  const report: ReportEntry[] = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
  const pending = report.filter((r) => r.status === 'image_upload_skipped' && r.productId && r.files?.length);
  console.log(`Entradas pendentes de upload: ${pending.length}`);

  const app = await NestFactory.createApplicationContext(UploadBootstrapModule, { logger: ['error', 'warn'] });
  const productsService = app.get(ProductsService);

  let productsDone = 0, productsFailed = 0, imagesUploaded = 0, imagesFailed = 0;

  for (const entry of pending) {
    const failedFiles: string[] = [];
    let uploadedForThisProduct = 0;

    for (const filename of entry.files!) {
      try {
        const buffer = readFileSync(join(IMAGES_DIR, filename));
        const ext = extname(filename).toLowerCase();
        const mimetype = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const fakeFile = {
          buffer, originalname: filename, mimetype, fieldname: 'files', encoding: '7bit', size: buffer.length,
        } as Express.Multer.File;
        await productsService.addImages(entry.productId!, [fakeFile]);
        uploadedForThisProduct++;
        imagesUploaded++;
      } catch (err) {
        imagesFailed++;
        failedFiles.push(filename);
        console.error(`  falha em ${filename}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (failedFiles.length === 0) {
      entry.status = 'uploaded';
      productsDone++;
    } else {
      entry.status = 'partial_upload_failure';
      (entry as any).failedFiles = failedFiles;
      productsFailed++;
    }
    (entry as any).imagesUploadedCount = uploadedForThisProduct;
    console.log(`${entry.slug}: ${uploadedForThisProduct}/${entry.files!.length} imagens`);
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n=== Resumo do upload ===');
  console.log(`Produtos 100% ok: ${productsDone}`);
  console.log(`Produtos com falha parcial: ${productsFailed}`);
  console.log(`Imagens enviadas: ${imagesUploaded} | Falhas: ${imagesFailed}`);
  console.log(`Relatório atualizado: ${REPORT_PATH}`);

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
