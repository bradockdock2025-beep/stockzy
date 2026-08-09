-- Seed de referência do catálogo facetado (Facet + FacetValue)
--
-- Fonte: buildingConcept/ (CONCEPT.md, PAGE-BROWSE-MEN.md, PAGE-CATEGORY-SNEAKERS.md,
-- PAGE-CATEGORY-SHOES.md, PAGE-CATEGORY-ACCESSORIES.md) + capturas de tela reais enviadas
-- na conversa (Activity, Color, Price, Age Group, Gender, Shoe Height, grids de
-- tamanho Men/Women/Kid).
--
-- Brand NÃO está aqui de propósito — fica em SQL_BRANDS_SEED.sql, rodado por último junto
-- com o cadastro de produto (marca é dado atrelado a produto real, não taxonomia base).
--
-- Pré-requisito: SQL_FULL_SCHEMA.sql já aplicado.
-- Idempotente: usa ON CONFLICT DO NOTHING nas chaves únicas (key/[facet_id,value]),
-- seguro rodar mais de uma vez.

-- ============================================================
-- FACETS
-- ============================================================

INSERT INTO facets (id, key, name, input_type, scope, visibility, visibility_value, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.key, v.name, v.input_type::"facet_input_type", v.scope::"facet_scope", v.visibility::"facet_visibility", v.visibility_value, v.sort_order, true, now(), now()
FROM (VALUES
  ('gender',      'Gender',        'checkbox', 'product', 'gender_fixed_absent', NULL,       10),
  ('age_group',   'Age Group',     'checkbox', 'product', 'gender_equals',       'kids',     15),
  ('activity',    'Activity',      'checkbox', 'product', 'always',              NULL,       20),
  ('color',       'Color',         'swatch',   'variant', 'always',              NULL,       30),
  ('shoe_height', 'Shoe Height',   'checkbox', 'product', 'category_family',     'calcado',  40),
  ('size_men',    'Men''s Size',   'chip',     'variant', 'always',              NULL,       50),
  ('size_women',  'Women''s Size', 'chip',     'variant', 'always',              NULL,       51),
  ('size_kids',   'Kid''s Size',   'chip',     'variant', 'always',              NULL,       52),
  ('size_apparel','Size',          'chip',     'variant', 'always',              NULL,       60)
) AS v(key, name, input_type, scope, visibility, visibility_value, sort_order)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FACET VALUES
-- ============================================================

-- Gender (banner_title/banner_description de Men/Women vêm dos prints reais de
-- /browse/men e /browse/women; Kids/Unisex ficam sem banner por ora, sem print pra confirmar)
INSERT INTO facet_values (id, facet_id, value, label, banner_title, banner_description, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.banner_title, v.banner_description, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('men','Men',NULL,'Fashion and products for men are all the rage these days, as athletic, streetwear, and luxury designer brands all race to stay up to date with the latest trends and customer demands. Products for men are becoming ever more popular, especially because most products made for...',1),
  ('women','Women',NULL,'Whether you''re after a specific collector''s item, timeless wardrobe essentials to elevate your closet, or standout pieces to add a fresh twist to your daily outfits, we have women covered. From luxury brands such like Amiri, Dior, Louis Vuitton and Palm Angels to streetwear labels...',2),
  ('kids','Kids',NULL,NULL,3),
  ('unisex','Unisex',NULL,NULL,4)
) AS v(value, label, banner_title, banner_description, sort_order)
WHERE f.key = 'gender'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Age Group (ordem decrescente de idade, como no print)
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('child','Child',1),
  ('preschool','Preschool',2),
  ('toddler','Toddler',3),
  ('infant','Infant',4)
) AS v(value, label, sort_order)
WHERE f.key = 'age_group'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Activity (ordem de relevância do print, não alfabética)
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('running','Running',1),
  ('basketball','Basketball',2),
  ('skateboarding','Skateboarding',3),
  ('soccer','Soccer',4),
  ('hiking','Hiking',5),
  ('golf','Golf',6),
  ('football','Football',7)
) AS v(value, label, sort_order)
WHERE f.key = 'activity'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Color (extra.hex pra swatch; "multi" é gradiente, sem hex único)
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.extra::jsonb, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('black','Black','{"hex":"#000000"}',1),
  ('white','White','{"hex":"#FFFFFF"}',2),
  ('multi','Multi','{"gradient":true}',3),
  ('blue','Blue','{"hex":"#3B5FE2"}',4),
  ('grey','Grey','{"hex":"#B0B0B0"}',5),
  ('red','Red','{"hex":"#B23A2E"}',6),
  ('yellow','Yellow','{"hex":"#E0B03E"}',7),
  ('brown','Brown','{"hex":"#4A332B"}',8),
  ('pink','Pink','{"hex":"#E3B8C0"}',9),
  ('purple','Purple','{"hex":"#5B4E9E"}',10),
  ('green','Green','{"hex":"#3A6B4A"}',11),
  ('orange','Orange','{"hex":"#D9713C"}',12)
) AS v(value, label, extra, sort_order)
WHERE f.key = 'color'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Shoe Height
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('low','Low',1),
  ('mid','Mid',2),
  ('high','High',3)
) AS v(value, label, sort_order)
WHERE f.key = 'shoe_height'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Men's Size — EU 39 até 47.5, canônico em EU (value/label), US equivalente em extra.
-- Ver ANALISE_FORMATO_TAMANHO_UNIVERSAL.md — conversão de referência padrão, não por marca.
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.extra::jsonb, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('39','EU 39','{"eu":"39","us":"6.5"}',1),
  ('40','EU 40','{"eu":"40","us":"7"}',2),
  ('40.5','EU 40.5','{"eu":"40.5","us":"7.5"}',3),
  ('41','EU 41','{"eu":"41","us":"8"}',4),
  ('42','EU 42','{"eu":"42","us":"8.5"}',5),
  ('42.5','EU 42.5','{"eu":"42.5","us":"9"}',6),
  ('43','EU 43','{"eu":"43","us":"9.5"}',7),
  ('44','EU 44','{"eu":"44","us":"10"}',8),
  ('44.5','EU 44.5','{"eu":"44.5","us":"10.5"}',9),
  ('45','EU 45','{"eu":"45","us":"11"}',10),
  ('45.5','EU 45.5','{"eu":"45.5","us":"11.5"}',11),
  ('46','EU 46','{"eu":"46","us":"12"}',12),
  ('47','EU 47','{"eu":"47","us":"12.5"}',13),
  ('47.5','EU 47.5','{"eu":"47.5","us":"13"}',14)
) AS v(value, label, extra, sort_order)
WHERE f.key = 'size_men'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Women's Size — EU 35 até 42, canônico em EU, US equivalente em extra.
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.extra::jsonb, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('35','EU 35','{"eu":"35","us":"4.5"}',1),
  ('35.5','EU 35.5','{"eu":"35.5","us":"5"}',2),
  ('36','EU 36','{"eu":"36","us":"5.5"}',3),
  ('36.5','EU 36.5','{"eu":"36.5","us":"6"}',4),
  ('37','EU 37','{"eu":"37","us":"6.5"}',5),
  ('37.5','EU 37.5','{"eu":"37.5","us":"7"}',6),
  ('38','EU 38','{"eu":"38","us":"7.5"}',7),
  ('38.5','EU 38.5','{"eu":"38.5","us":"8"}',8),
  ('39','EU 39','{"eu":"39","us":"8.5"}',9),
  ('40','EU 40','{"eu":"40","us":"9"}',10),
  ('40.5','EU 40.5','{"eu":"40.5","us":"9.5"}',11),
  ('41','EU 41','{"eu":"41","us":"10"}',12),
  ('42','EU 42','{"eu":"42","us":"10.5"}',13)
) AS v(value, label, extra, sort_order)
WHERE f.key = 'size_women'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Kid's Size — EU 16 até 26, canônico em EU, US (toddler "C") equivalente em extra.
-- Conversão infantil varia mais entre fontes/marcas que a adulta — tabela de referência padrão.
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.extra::jsonb, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('16','EU 16','{"eu":"16","us":"0C"}',1),
  ('17','EU 17','{"eu":"17","us":"1C"}',2),
  ('18','EU 18','{"eu":"18","us":"2C"}',3),
  ('18.5','EU 18.5','{"eu":"18.5","us":"2.5C"}',4),
  ('19','EU 19','{"eu":"19","us":"3C"}',5),
  ('19.5','EU 19.5','{"eu":"19.5","us":"3.5C"}',6),
  ('20','EU 20','{"eu":"20","us":"4C"}',7),
  ('20.5','EU 20.5','{"eu":"20.5","us":"4.5C"}',8),
  ('21','EU 21','{"eu":"21","us":"5C"}',9),
  ('22','EU 22','{"eu":"22","us":"5.5C"}',10),
  ('22.5','EU 22.5','{"eu":"22.5","us":"6C"}',11),
  ('23','EU 23','{"eu":"23","us":"6.5C"}',12),
  ('23.5','EU 23.5','{"eu":"23.5","us":"7C"}',13),
  ('24','EU 24','{"eu":"24","us":"7.5C"}',14),
  ('24.5','EU 24.5','{"eu":"24.5","us":"8C"}',15),
  ('25','EU 25','{"eu":"25","us":"8.5C"}',16),
  ('25.5','EU 25.5','{"eu":"25.5","us":"9C"}',17),
  ('26','EU 26','{"eu":"26","us":"9.5C"}',18)
) AS v(value, label, extra, sort_order)
WHERE f.key = 'size_kids'
ON CONFLICT (facet_id, value) DO NOTHING;

-- Apparel Size — grade genérica de letra (XS-XXL). visibility='always' (dinâmico, some
-- da resposta se a contagem zerar) — mesmo critério de size_men/size_women/size_kids,
-- não fixo por categoria (ver ANALISE_CONSISTENCIA_SISTEMA.md item 2.3: tamanho é algo
-- que qualquer produto pode ou não ter, não depende da categoria em si).
INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('xs','XS',1),
  ('s','S',2),
  ('m','M',3),
  ('l','L',4),
  ('xl','XL',5),
  ('xxl','XXL',6)
) AS v(value, label, sort_order)
WHERE f.key = 'size_apparel'
ON CONFLICT (facet_id, value) DO NOTHING;
