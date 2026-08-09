-- ============================================================
-- Doja Fashion — Categorias, Subcategorias e Atributos
-- Safe to re-run: upsert por slug (ON CONFLICT (slug) DO UPDATE)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASSO 1 — Categorias PAI (departamentos / filtros do site)
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
VALUES
  ('Tops',        'tops',        'TOP', true, NULL),
  ('Bottoms',     'bottoms',     'BOT', true, NULL),
  ('Outerwear',   'outerwear',   'OUT', true, NULL),
  ('Footwear',    'footwear',    'FTW', true, NULL),
  ('Accessories', 'accessories', 'ACC', true, NULL)
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 2 — Subcategorias TOPS
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
SELECT sub.name, sub.slug, sub.code, true, c.id
FROM (VALUES
  ('T-Shirts',             't-shirts',             'TSH'),
  ('Shirts',               'shirts',               'SHI'),
  ('Hoodies & Sweatshirts','hoodies-sweatshirts',  'HOO'),
  ('Knitwear',             'knitwear',             'KNI'),
  ('Tanks & Vests',        'tanks-vests',          'TAN')
) AS sub(name, slug, code)
CROSS JOIN categories c
WHERE c.slug = 'tops'
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 3 — Subcategorias BOTTOMS
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
SELECT sub.name, sub.slug, sub.code, true, c.id
FROM (VALUES
  ('Jeans',    'jeans',    'JEA'),
  ('Trousers', 'trousers', 'TRS'),
  ('Shorts',   'shorts',   'SHO'),
  ('Skirts',   'skirts',   'SKT'),
  ('Leggings', 'leggings', 'LEG')
) AS sub(name, slug, code)
CROSS JOIN categories c
WHERE c.slug = 'bottoms'
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 4 — Subcategorias OUTERWEAR
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
SELECT sub.name, sub.slug, sub.code, true, c.id
FROM (VALUES
  ('Jackets', 'jackets', 'JAC'),
  ('Coats',   'coats',   'COA'),
  ('Blazers', 'blazers', 'BLA')
) AS sub(name, slug, code)
CROSS JOIN categories c
WHERE c.slug = 'outerwear'
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 5 — Subcategorias FOOTWEAR
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
SELECT sub.name, sub.slug, sub.code, true, c.id
FROM (VALUES
  ('Trainers', 'trainers', 'TRA'),
  ('Boots',    'boots',    'BOO'),
  ('Sandals',  'sandals',  'SND'),
  ('Heels',    'heels',    'HEE'),
  ('Loafers',  'loafers',  'LOA')
) AS sub(name, slug, code)
CROSS JOIN categories c
WHERE c.slug = 'footwear'
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 6 — Subcategorias ACCESSORIES
-- ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, code, is_active, parent_id)
SELECT sub.name, sub.slug, sub.code, true, c.id
FROM (VALUES
  ('Bags',        'bags',        'BAG'),
  ('Hats',        'hats',        'HAT'),
  ('Scarves',     'scarves',     'SCA'),
  ('Jewellery',   'jewellery',   'JEW'),
  ('Belts',       'belts',       'BEL'),
  ('Sunglasses',  'sunglasses',  'SUN')
) AS sub(name, slug, code)
CROSS JOIN categories c
WHERE c.slug = 'accessories'
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      code      = EXCLUDED.code,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active;

-- ──────────────────────────────────────────────────────────────
-- PASSO 7 — Atributos: Tops e subcategorias
-- ──────────────────────────────────────────────────────────────
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, attr.name, attr.data_type, attr.is_required
FROM categories c
CROSS JOIN (VALUES
  ('Colour',   'text',    true),
  ('Size',     'text',    true),
  ('Material', 'text',    false),
  ('Fit',      'text',    false),
  ('Gender',   'text',    false)
) AS attr(name, data_type, is_required)
WHERE c.slug IN ('tops', 't-shirts', 'shirts', 'hoodies-sweatshirts', 'knitwear', 'tanks-vests')
  AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.name = attr.name
  );

-- ──────────────────────────────────────────────────────────────
-- PASSO 8 — Atributos: Bottoms e subcategorias
-- ──────────────────────────────────────────────────────────────
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, attr.name, attr.data_type, attr.is_required
FROM categories c
CROSS JOIN (VALUES
  ('Colour',   'text',    true),
  ('Size',     'text',    true),
  ('Material', 'text',    false),
  ('Fit',      'text',    false),
  ('Gender',   'text',    false),
  ('Length',   'text',    false)
) AS attr(name, data_type, is_required)
WHERE c.slug IN ('bottoms', 'jeans', 'trousers', 'shorts', 'skirts', 'leggings')
  AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.name = attr.name
  );

-- ──────────────────────────────────────────────────────────────
-- PASSO 9 — Atributos: Outerwear e subcategorias
-- ──────────────────────────────────────────────────────────────
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, attr.name, attr.data_type, attr.is_required
FROM categories c
CROSS JOIN (VALUES
  ('Colour',   'text',    true),
  ('Size',     'text',    true),
  ('Material', 'text',    false),
  ('Lining',   'text',    false),
  ('Gender',   'text',    false)
) AS attr(name, data_type, is_required)
WHERE c.slug IN ('outerwear', 'jackets', 'coats', 'blazers')
  AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.name = attr.name
  );

-- ──────────────────────────────────────────────────────────────
-- PASSO 10 — Atributos: Footwear e subcategorias
-- ──────────────────────────────────────────────────────────────
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, attr.name, attr.data_type, attr.is_required
FROM categories c
CROSS JOIN (VALUES
  ('Colour',       'text',    true),
  ('Shoe Size',    'text',    true),
  ('Material',     'text',    false),
  ('Heel Height',  'text',    false),
  ('Gender',       'text',    false)
) AS attr(name, data_type, is_required)
WHERE c.slug IN ('footwear', 'trainers', 'boots', 'sandals', 'heels', 'loafers')
  AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.name = attr.name
  );

-- ──────────────────────────────────────────────────────────────
-- PASSO 11 — Atributos: Accessories e subcategorias
-- ──────────────────────────────────────────────────────────────
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, attr.name, attr.data_type, attr.is_required
FROM categories c
CROSS JOIN (VALUES
  ('Colour',   'text',    true),
  ('Material', 'text',    false),
  ('Size',     'text',    false),
  ('Gender',   'text',    false)
) AS attr(name, data_type, is_required)
WHERE c.slug IN ('accessories', 'bags', 'hats', 'scarves', 'jewellery', 'belts', 'sunglasses')
  AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.name = attr.name
  );

-- ──────────────────────────────────────────────────────────────
-- VERIFICAÇÃO — Ver o que foi criado
-- ──────────────────────────────────────────────────────────────
SELECT
  COALESCE(parent.name, '—') AS departamento,
  c.name                     AS categoria,
  c.slug,
  c.code,
  c.is_active,
  COUNT(ca.id)               AS num_atributos
FROM categories c
LEFT JOIN categories parent ON parent.id = c.parent_id
LEFT JOIN category_attributes ca ON ca.category_id = c.id
WHERE c.slug IN (
  'tops','bottoms','outerwear','footwear','accessories',
  't-shirts','shirts','hoodies-sweatshirts','knitwear','tanks-vests',
  'jeans','trousers','shorts','skirts','leggings',
  'jackets','coats','blazers',
  'trainers','boots','sandals','heels','loafers',
  'bags','hats','scarves','jewellery','belts','sunglasses'
)
GROUP BY parent.name, c.name, c.slug, c.code, c.is_active
ORDER BY departamento, c.parent_id NULLS FIRST, c.name;
