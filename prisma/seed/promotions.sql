-- Promotions (MVP enterprise)
-- Run manually (no Prisma migrations).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type') THEN
    CREATE TYPE promotion_type AS ENUM ('percent', 'fixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_target_type') THEN
    CREATE TYPE promotion_target_type AS ENUM ('cart', 'product', 'category');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  type promotion_type NOT NULL,
  value numeric(12,2) NOT NULL,
  is_active boolean DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  priority int DEFAULT 0,
  min_subtotal numeric(12,2),
  max_uses int,
  max_uses_per_customer int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions (is_active);

CREATE INDEX IF NOT EXISTS idx_promotions_window
  ON promotions (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS promotion_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  target_type promotion_target_type NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_targets_promotion
  ON promotion_targets (promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_targets_product
  ON promotion_targets (product_id);

CREATE INDEX IF NOT EXISTS idx_promotion_targets_category
  ON promotion_targets (category_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promotion_targets
  ON promotion_targets (promotion_id, target_type, product_id, category_id);

CREATE TABLE IF NOT EXISTS promotion_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion
  ON promotion_usages (promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_customer
  ON promotion_usages (customer_id);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_used
  ON promotion_usages (used_at);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_promotion_usage_order
  ON promotion_usages (promotion_id, order_id)
  WHERE order_id IS NOT NULL;
