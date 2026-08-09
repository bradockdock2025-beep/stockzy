-- ============================================================
-- Recommendations Module — Schema Migration
-- Compilar manualmente no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de visualizações de produtos (Fase 2 — rastreio de sessão)
CREATE TABLE IF NOT EXISTS product_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID        REFERENCES customers(id) ON DELETE SET NULL,
  session_id  TEXT        NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id  ON product_views (product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_session_id  ON product_views (session_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at   ON product_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_customer_id ON product_views (customer_id) WHERE customer_id IS NOT NULL;

-- 2. Tabela materializada de co-ocorrências (Fase 1 + Fase 2)
CREATE TABLE IF NOT EXISTS product_co_occurrences (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_a UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id_b UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  signal       TEXT         NOT NULL,   -- 'co_view' | 'co_purchase' | 'co_cart'
  score        NUMERIC(10,6) NOT NULL DEFAULT 0,
  pair_count   INTEGER      NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_co_occurrence UNIQUE (product_id_a, product_id_b, signal)
);

CREATE INDEX IF NOT EXISTS idx_co_occ_product_a_score ON product_co_occurrences (product_id_a, score DESC);
CREATE INDEX IF NOT EXISTS idx_co_occ_signal          ON product_co_occurrences (signal);
