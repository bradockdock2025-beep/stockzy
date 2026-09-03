/**
 * Sobe as imagens pros 127 produtos já criados por scripts/seed-luxury-drop-from-public.ts
 * (rodado sem ALLOW_IMAGE_UPLOAD=1 primeiro, de propósito, pra revisar os produtos antes
 * de subir ~300 arquivos de verdade pro Storage). Lê SEED_LUXURY_DROP_REPORT.json —
 * cada entrada com status 'image_upload_skipped' tem productId + a lista de arquivos.
 *
 * Idempotente na prática: se rodar de novo, tenta subir de novo os arquivos que já
 * subiram (cria imagem duplicada) — por isso o relatório de saída marca cada entrada
 * como 'uploaded' e um segundo run deveria, no fluxo normal, não ser necessário; se
 * precisar reprocessar só as falhas, filtre o SEED_LUXURY_DROP_REPORT.json antes.
 *
 * Uso: npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false}' -r tsconfig-paths/register scripts/upload-images-for-luxury-drop.ts
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

const PUBLIC_ROOT = join(__dirname, '..', 'frontend', 'public');
const REPORT_PATH = join(__dirname, '..', 'SEED_LUXURY_DROP_REPORT.json');

interface ReportEntry {
  group: string;
  status: string;
  productId?: string;
  slug?: string;
  category?: string;
  brand?: string;
  imageCount?: number;
  files?: string[];
  reason?: string;
}

async function main() {
  const report: ReportEntry[] = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
  const pending = report.filter((r) => r.status === 'image_upload_skipped' && r.productId && r.files?.length);

  console.log(`Entradas pendentes de upload: ${pending.length}`);

  const app = await NestFactory.createApplicationContext(UploadBootstrapModule, { logger: ['error', 'warn'] });
  const productsService = app.get(ProductsService);

  let productsDone = 0;
  let productsFailed = 0;
  let imagesUploaded = 0;
  let imagesFailed = 0;

  for (const entry of pending) {
    const failedFiles: string[] = [];
    let uploadedForThisProduct = 0;

    for (const relFile of entry.files!) {
      try {
        const full = join(PUBLIC_ROOT, relFile);
        const buffer = readFileSync(full);
        const ext = extname(relFile).toLowerCase();
        const mimetype = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const fakeFile = {
          buffer, originalname: relFile.split('/').pop()!, mimetype, fieldname: 'files', encoding: '7bit', size: buffer.length,
        } as Express.Multer.File;
        await productsService.addImages(entry.productId!, [fakeFile]);
        uploadedForThisProduct++;
        imagesUploaded++;
      } catch (err) {
        imagesFailed++;
        failedFiles.push(relFile);
        console.error(`  falha em ${relFile}: ${err instanceof Error ? err.message : String(err)}`);
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
