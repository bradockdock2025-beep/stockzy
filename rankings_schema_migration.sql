-- =============================================================
-- MIGRATION: Rankings + Featured fields
-- Aplica as alterações necessárias para as 4 secções da homepage
-- =============================================================

-- 1. Novos campos na tabela products
-- -------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS featured_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_order  INTEGER;

-- Índice para queries de destaques ordenados por data de expiração
CREATE INDEX IF NOT EXISTS idx_products_featured_until
  ON products (featured_until);

-- 2. Tabela product_rankings
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_rankings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID        NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  units_sold_7d  INTEGER     NOT NULL DEFAULT 0,
  units_sold_30d INTEGER     NOT NULL DEFAULT 0,
  units_sold_all INTEGER     NOT NULL DEFAULT 0,
  score          NUMERIC(12, 4) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para ordenação por score descendente (mais vendidos)
CREATE INDEX IF NOT EXISTS idx_product_rankings_score
  ON product_rankings (score DESC);
