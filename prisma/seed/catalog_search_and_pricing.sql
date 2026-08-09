-- Catalog: price history + full-text search + case-insensitive unique indexes
-- Run manually (no Prisma migrations).

-- 1) Price history
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  compare_at_price numeric(12,2),
  actor_id uuid,
  actor_email text,
  actor_role text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_variant_created
  ON price_history (variant_id, created_at DESC);

-- 2) Full-text search vectors
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.slug, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

CREATE OR REPLACE FUNCTION product_variants_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.sku, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_variants_search_vector_trigger ON product_variants;
CREATE TRIGGER product_variants_search_vector_trigger
BEFORE INSERT OR UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION product_variants_search_vector_update();

-- Backfill existing rows
UPDATE products
SET search_vector =
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(slug, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'C');

UPDATE product_variants
SET search_vector =
  setweight(to_tsvector('simple', coalesce(sku, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(title, '')), 'B');

CREATE INDEX IF NOT EXISTS idx_products_search_vector
  ON products USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_variants_search_vector
  ON product_variants USING GIN (search_vector);

-- 3) Case-insensitive uniqueness (single-tenant)
-- If duplicates exist, these indexes will fail; clean duplicates first.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_slug_ci
  ON products (lower(slug));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_variants_sku_ci
  ON product_variants (lower(sku));
