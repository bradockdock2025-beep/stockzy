-- Make Offer (negociação de preço) — Fase 1, ver PLANO_MAKE_OFFER.md
-- Sem auto-aceite/motor de concorrência ainda (§4.1 do plano): toda oferta
-- nasce "pending" e é decidida manualmente pelo admin. "pending_window" e
-- "windowClosesAt" ficam reservados pra Fase 2.
-- Idempotente (IF NOT EXISTS), mesmo padrão das outras migrations manuais
-- deste projeto (ex.: 20260620_add_guest_checkout).

DO $$ BEGIN
  CREATE TYPE "offer_status" AS ENUM ('pending', 'pending_window', 'accepted', 'rejected', 'expired', 'converted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "customer_id" UUID,
    "guest_email" TEXT,
    "guest_token" TEXT,
    "listed_price" DECIMAL(12,2) NOT NULL,
    "offered_price" DECIMAL(12,2) NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt',
    "status" "offer_status" NOT NULL DEFAULT 'pending',
    "window_closes_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "responded_at" TIMESTAMPTZ(6),
    "responded_by" UUID,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offers_guest_token_key" ON "offers"("guest_token");
CREATE UNIQUE INDEX IF NOT EXISTS "offers_order_id_key" ON "offers"("order_id");
CREATE INDEX IF NOT EXISTS "idx_offers_variant" ON "offers"("variant_id");
CREATE INDEX IF NOT EXISTS "idx_offers_status" ON "offers"("status");

DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
