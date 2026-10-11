-- Separa "aprovar" de "publicar": aprovar deixa de criar o produto na hora. Fluxo passa a
-- ser pending_review -> under_review -> approved -> published (ou rejected a qualquer
-- momento antes de published). O produto só é criado no passo "publish", explícito.

ALTER TYPE "seller_submission_status" ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE "seller_submission_status" ADD VALUE IF NOT EXISTS 'published';

ALTER TABLE "seller_submissions" ADD COLUMN "published_at" TIMESTAMPTZ(6);
ALTER TABLE "seller_submissions" ADD COLUMN "published_by" UUID;
