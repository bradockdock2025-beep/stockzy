-- Cria a tabela `offers` (feature "Make Offer") no banco real — ela está no
-- schema.prisma e o código todo já espera por ela (src/modules/offers/*), mas nunca foi
-- migrada. Confirmado agora: GET /admin/offers responde 500 ("relation \"offers\" does
-- not exist"), e SELECT direto no banco confirma que nem a tabela nem o enum
-- `offer_status` existem hoje. Todas as tabelas referenciadas (product_variants,
-- customers, orders) já existem, então é seguro criar.
--
-- Estrutura extraída direto de `model Offer` em prisma/schema.prisma — mesma convenção
-- de nomes/colunas/constraints já usada em SQL_FULL_SCHEMA.sql pras outras tabelas
-- (ex.: FK opcional pra customer/order = ON DELETE SET NULL, igual orders.customer_id;
-- FK obrigatória pra variant = ON DELETE CASCADE, igual product_variants).
--
-- Idempotente: os 3 passos (tipo, tabela, índices, FKs) checam existência antes de criar,
-- seguro rodar mais de uma vez.

-- 1) Enum de status da oferta
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE "offer_status" AS ENUM ('pending', 'pending_window', 'accepted', 'rejected', 'expired', 'converted');
  END IF;
END $$;

-- 2) Tabela
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

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "offers_guest_token_key" UNIQUE ("guest_token"),
    CONSTRAINT "offers_order_id_key" UNIQUE ("order_id")
);

-- 3) Índices (mesmos nomes do @@index no schema.prisma)
CREATE INDEX IF NOT EXISTS "idx_offers_variant" ON "offers"("variant_id");
CREATE INDEX IF NOT EXISTS "idx_offers_status" ON "offers"("status");

-- 4) Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_variant_id_fkey'
  ) THEN
    ALTER TABLE "offers" ADD CONSTRAINT "offers_variant_id_fkey"
      FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_customer_id_fkey'
  ) THEN
    ALTER TABLE "offers" ADD CONSTRAINT "offers_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_order_id_fkey'
  ) THEN
    ALTER TABLE "offers" ADD CONSTRAINT "offers_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
