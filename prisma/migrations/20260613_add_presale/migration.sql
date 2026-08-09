-- Adicionar valor 'presale' ao enum order_status
-- Em PostgreSQL, ADD VALUE não pode correr dentro de uma transação explícita
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'presale' AFTER 'paid';

-- Adicionar campos de pré-venda à tabela product_variants
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "presale_enabled"       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "presale_price"         DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "presale_limit"         INTEGER,
  ADD COLUMN IF NOT EXISTS "expected_available_at" TIMESTAMPTZ;
