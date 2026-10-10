-- ANALISE_SELLER_PRODUCT_SUBMISSION.md — vendedor sem conta submete um produto; admin
-- aprova (cria Product/ProductVariant/Inventory/ProductImage de verdade) ou rejeita.

CREATE TYPE "seller_submission_status" AS ENUM ('pending_review', 'approved', 'rejected');
CREATE TYPE "seller_item_condition" AS ENUM ('new', 'like_new', 'used_good', 'used_fair');

CREATE TABLE "seller_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_name" TEXT NOT NULL,
  "seller_email" TEXT NOT NULL,
  "seller_phone" TEXT NOT NULL,
  "guest_token" TEXT NOT NULL,
  "category_id" UUID NOT NULL,
  "brand" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "condition" "seller_item_condition" NOT NULL,
  "original_box" BOOLEAN,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "asking_price" DECIMAL(12,2) NOT NULL,
  "additional_details" TEXT,
  "spreadsheet_link" TEXT,
  "status" "seller_submission_status" NOT NULL DEFAULT 'pending_review',
  "rejection_reason" TEXT,
  "responded_at" TIMESTAMPTZ(6),
  "responded_by" UUID,
  "product_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "seller_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_submissions_guest_token_key" UNIQUE ("guest_token"),
  CONSTRAINT "seller_submissions_product_id_key" UNIQUE ("product_id"),
  CONSTRAINT "seller_submissions_category_id_fkey" FOREIGN KEY ("category_id")
    REFERENCES "categories"("id"),
  CONSTRAINT "seller_submissions_product_id_fkey" FOREIGN KEY ("product_id")
    REFERENCES "products"("id")
);

CREATE INDEX "idx_seller_submissions_status" ON "seller_submissions"("status");
CREATE INDEX "idx_seller_submissions_guest_token" ON "seller_submissions"("guest_token");

CREATE TABLE "seller_submission_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "seller_submission_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_submission_images_submission_id_fkey" FOREIGN KEY ("submission_id")
    REFERENCES "seller_submissions"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_seller_submission_images_submission" ON "seller_submission_images"("submission_id");
