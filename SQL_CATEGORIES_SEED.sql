-- Seed de Categories — estrutura confirmada em PROPOSTA_ESTRUTURA_CATEGORIAS.md (2026-07-26)
--
-- Fonte: buildingConcept/CONCEPT.md (mega menu StockX), a mesma referência já usada pros
-- facets (Gender/Activity/Color/Shoe Height) e pela regra category_family.
--
-- family_tag: "calcado" em Sneakers/Shoes (bate com visibility_value das facetas
-- shoe_height/size_men/size_women/size_kids em SQL_CATALOG_FACETS_SEED.sql);
-- "vestuario" em Apparel (sem faceta correspondente ainda — só fica pronto).
--
-- code: 3 letras por nível, vira o SKU {DEPTO}-{CAT}-{ANO}-{SEQ}. `code` não tem
-- constraint de unicidade no schema (só `slug` é único) — algumas subcategorias de
-- famílias diferentes reaproveitam o mesmo code (ex.: Shoes/Boots e Apparel/Bottoms
-- = BOT; Collectibles/Homeware, Electronics/Computer Components e Accessories/Home &
-- Lifestyle não colidem entre si; Collectibles/Comic Books e Electronics/Computer
-- Components ambos = COM), sem problema porque o SKU sempre combina depto+categoria.
--
-- Pré-requisito: SQL_FULL_SCHEMA.sql já aplicado.
-- Idempotente: ON CONFLICT (slug) DO NOTHING, seguro rodar mais de uma vez.

-- ============================================================
-- CATEGORIAS-RAIZ (departamentos)
-- ============================================================

INSERT INTO categories (id, name, slug, code, family_tag, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, v.family_tag, true, now(), now()
FROM (VALUES
  ('Sneakers','sneakers','SNK','calcado'),
  ('Shoes','shoes','SHO','calcado'),
  ('Apparel','apparel','APP','vestuario'),
  ('Accessories','accessories','ACC',NULL),
  ('Collectibles','collectibles','COL',NULL),
  ('Electronics','electronics','ELE',NULL),
  ('Trading Cards','trading-cards','TRC',NULL)
) AS v(name, slug, code, family_tag)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SUBCATEGORIAS
-- ============================================================

-- Sneakers
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Lifestyle','lifestyle','LFS'),
  ('Performance','performance','PRF'),
  ('Luxury','luxury','LUX')
) AS v(name, slug, code)
WHERE p.slug = 'sneakers'
ON CONFLICT (slug) DO NOTHING;

-- Shoes
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Slides & Sandals','slides-sandals','SLD'),
  ('Cleats','cleats','CLT'),
  ('Boots','boots','BOT'),
  ('Clogs','clogs','CLG'),
  ('Loafers','loafers','LOA'),
  ('Slippers','slippers','SLP'),
  ('Heels','heels','HEE'),
  ('Oxfords','oxfords','OXF'),
  ('Flats','flats','FLA'),
  ('Spikes','spikes','SPK')
) AS v(name, slug, code)
WHERE p.slug = 'shoes'
ON CONFLICT (slug) DO NOTHING;

-- Apparel
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Tops','tops','TOP'),
  ('Bottoms','bottoms','BOT'),
  ('Outerwear','outerwear','OUT'),
  ('Undergarments','undergarments','UND'),
  ('Other Apparel','other-apparel','OTH')
) AS v(name, slug, code)
WHERE p.slug = 'apparel'
ON CONFLICT (slug) DO NOTHING;

-- Accessories
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Bags','bags','BAG'),
  ('Belts','belts','BEL'),
  ('Eyewear','eyewear','EYE'),
  ('Headwear','headwear','HEA'),
  ('Jewelry','jewelry','JEW'),
  ('Watches','watches','WAT'),
  ('Wallets & Card Holders','wallets-card-holders','WAL'),
  ('Tech Accessories','tech-accessories','TEC'),
  ('Face Masks','face-masks','MSK'),
  ('Home & Lifestyle','home-lifestyle','HOM'),
  ('Lanyards & Keychains','lanyards-keychains','LAN'),
  ('Other Accessories','other-accessories','OTH')
) AS v(name, slug, code)
WHERE p.slug = 'accessories'
ON CONFLICT (slug) DO NOTHING;

-- Collectibles
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Figures','figures','FIG'),
  ('Toys','toys','TOY'),
  ('Plushes','plushes','PLU'),
  ('Comic Books','comic-books','COM'),
  ('Prints','prints','PRI'),
  ('Pins and Keychains','pins-keychains','PIN'),
  ('Skate Decks','skate-decks','SKA'),
  ('Sports Equipment','sports-equipment','SPO'),
  ('Homeware','homeware','HOM'),
  ('Analog Music','analog-music','MUS'),
  ('Food & Consumer Products','food-consumer-products','FOO'),
  ('Other Collectibles','other-collectibles','OTH')
) AS v(name, slug, code)
WHERE p.slug = 'collectibles'
ON CONFLICT (slug) DO NOTHING;

-- Electronics
INSERT INTO categories (id, name, slug, code, family_tag, parent_id, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, v.code, p.family_tag, p.id, true, now(), now()
FROM categories p
CROSS JOIN (VALUES
  ('Audio','audio','AUD'),
  ('Cellphones','cellphones','CEL'),
  ('Tablets','tablets','TAB'),
  ('Laptops & Desktops','laptops-desktops','LAP'),
  ('Gaming Consoles','gaming-consoles','CON'),
  ('Video Games','video-games','VID'),
  ('Computer and Gaming (Peripherals)','computer-gaming-peripherals','PER'),
  ('Computer Components','computer-components','COM'),
  ('Smartwatches','smartwatches','SWA'),
  ('Small Appliances','small-appliances','APL'),
  ('Other Electronics','other-electronics','OTH')
) AS v(name, slug, code)
WHERE p.slug = 'electronics'
ON CONFLICT (slug) DO NOTHING;

-- Trading Cards não tem subcategoria confirmada (ver PROPOSTA_ESTRUTURA_CATEGORIAS.md §Trading Cards)
