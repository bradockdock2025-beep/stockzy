-- Preenche os dois últimos gaps de "Shop by Category" (Shirts e Dresses) que não tinham
-- NENHUM produto real no catálogo (confirmado em VERIFICACAO-DADOS-SHOP-BY-CATEGORY-BZ.md).
-- Decisão explícita do usuário: em vez de reetiquetar produto existente com nome errado
-- (uma jaqueta aparecendo como "Dresses" pro cliente) ou usar dado fabricado sem base,
-- CLONA 4 produtos reais como registros NOVOS — SKU novo, nome/slug ajustados pra soar
-- como a peça certa, categoria certa — mantendo marca, preço, variantes de tamanho,
-- estoque e as fotos que já existem (não temos foto nova de vestido/camisa social; assumido
-- como aceitável pra preencher a seção por ora, já que este catálogo é dado de dev/staging,
-- não produção real).
--
-- Shirts (4 clones, ficam em Tops + ganham garment_type:shirt novo — valor que nunca
-- existiu, distinto de t-shirt):
--   Chrome Hearts Foti Long Sleeve Shirt White        → Chrome Hearts Foti Oxford Shirt White
--   Paly Hollywood Bethlehem L/S T-Shirt               → Paly Hollywood Bethlehem Button Shirt
--   Rhude Split Petrol Logo Mesh LS Tee Vintage WhiteRed → Rhude Split Petrol Logo Shirt Vintage WhiteRed
--   Enfants Riches Deprimes School Days Long Sleeve T Shirt Faded BlackWhite → ...School Days Shirt Faded BlackWhite
--
-- Dresses (4 clones, todos partem de produto já gender:women — pedido do usuário — vão pra
-- categoria Dresses; não precisam de garment_type extra, mesmo critério já usado pra
-- Belts/Watches/Jewelry: a categoria já é específica o suficiente):
--   Bottega Desires Women's Madonna Sleeveless T-Shirt Black → ...Madonna Slip Dress Black
--   Bottega Desires Women's Madonna Sleeveless T-Shirt White → ...Madonna Slip Dress White
--   Bottega Desires Women's Studded Velour Sweatpants        → ...Studded Velour Maxi Dress
--   Bottega Desires Women's Studded Velour Jacket             → ...Studded Velour Shift Dress
--
-- O produto ORIGINAL de cada um continua existindo, intocado, na categoria/tag original —
-- isto só ADICIONA os 8 clones, não remove nem move nada.
--
-- Idempotente por slug: se rodar duas vezes, a segunda vez não insere de novo (slug é
-- UNIQUE e o script para de propósito se algum já existir — ver checagem no fim).
--
-- Pré-requisito: SQL_GENDER_BACKFILL_WOMEN.sql e SQL_GENDER_BACKFILL_UNISEX_DEFAULT.sql já
-- aplicados (senão os clones de Shirt não teriam gender:unisex pra herdar).

BEGIN;

CREATE TEMP TABLE clone_map (
  source_product_id uuid,
  new_product_id uuid,
  new_name text,
  new_slug text,
  new_description text,
  target_category_id uuid,
  kind text
) ON COMMIT DROP;

INSERT INTO clone_map (source_product_id, new_product_id, new_name, new_slug, new_description, target_category_id, kind) VALUES
  ('2ee69d4c-30b6-4f2a-8cce-4ed6ff1f9477'::uuid, gen_random_uuid(), 'Chrome Hearts Foti Oxford Shirt White', 'chrome-hearts-foti-oxford-shirt-white', 'Chrome Hearts Foti Oxford Shirt White.', 'cef20acb-f27c-4b6f-8d4e-c23d5beb95d0'::uuid, 'shirt'),
  ('17f0398d-2eef-48f1-a49c-a07912c48b83'::uuid, gen_random_uuid(), 'Paly Hollywood Bethlehem Button Shirt', 'paly-hollywood-bethlehem-button-shirt', 'Paly Hollywood Bethlehem Button Shirt.', 'cef20acb-f27c-4b6f-8d4e-c23d5beb95d0'::uuid, 'shirt'),
  ('efbe87d2-dfaa-42b7-99ce-5666b385913d'::uuid, gen_random_uuid(), 'Rhude Split Petrol Logo Shirt Vintage WhiteRed', 'rhude-split-petrol-logo-shirt-vintage-whitered', 'Rhude Split Petrol Logo Shirt Vintage WhiteRed.', 'cef20acb-f27c-4b6f-8d4e-c23d5beb95d0'::uuid, 'shirt'),
  ('be0e47aa-ca9c-427f-9af6-79f3bea124a1'::uuid, gen_random_uuid(), 'Enfants Riches Deprimes School Days Shirt Faded BlackWhite', 'enfants-riches-deprimes-school-days-shirt-faded-blackwhite', 'Enfants Riches Deprimes School Days Shirt Faded BlackWhite.', 'cef20acb-f27c-4b6f-8d4e-c23d5beb95d0'::uuid, 'shirt'),
  ('8e953340-3da5-492c-891f-2a4159e74dfe'::uuid, gen_random_uuid(), 'Bottega Desires Madonna Slip Dress Black', 'bottega-desires-madonna-slip-dress-black', 'Bottega Desires Madonna Slip Dress Black.', '11300504-f2c8-4a24-865d-29a3afc99d2e'::uuid, 'dress'),
  ('ab28e0f5-e9f0-42da-b42d-adc66f2206d9'::uuid, gen_random_uuid(), 'Bottega Desires Madonna Slip Dress White', 'bottega-desires-madonna-slip-dress-white', 'Bottega Desires Madonna Slip Dress White.', '11300504-f2c8-4a24-865d-29a3afc99d2e'::uuid, 'dress'),
  ('c7f7d362-ddc9-4bb8-b52b-8f077ed03989'::uuid, gen_random_uuid(), 'Bottega Desires Studded Velour Maxi Dress', 'bottega-desires-studded-velour-maxi-dress', 'Bottega Desires Studded Velour Maxi Dress.', '11300504-f2c8-4a24-865d-29a3afc99d2e'::uuid, 'dress'),
  ('853fd7ce-9f1f-4f20-8742-d8f8c1990f25'::uuid, gen_random_uuid(), 'Bottega Desires Studded Velour Shift Dress', 'bottega-desires-studded-velour-shift-dress', 'Bottega Desires Studded Velour Shift Dress.', '11300504-f2c8-4a24-865d-29a3afc99d2e'::uuid, 'dress');

-- Corta a execução se algum slug já existir (idempotência / evita rodar 2x sem querer)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products p JOIN clone_map cm ON cm.new_slug = p.slug) THEN
    RAISE EXCEPTION 'Clone já aplicado antes — pelo menos um slug de clone_map já existe em products. Abortando pra não duplicar.';
  END IF;
END $$;

CREATE TEMP TABLE variant_clone_map (
  source_variant_id uuid,
  new_variant_id uuid,
  new_product_id uuid,
  new_sku text
) ON COMMIT DROP;

INSERT INTO variant_clone_map (source_variant_id, new_variant_id, new_product_id, new_sku)
SELECT pv.id, gen_random_uuid(), cm.new_product_id,
       'DEV-' || upper(substr(replace(cm.new_product_id::text, '-', ''), 1, 8)) || '-' || split_part(pv.sku, '-', 3)
FROM product_variants pv
JOIN clone_map cm ON cm.source_product_id = pv.product_id;

-- 1) Produtos novos
INSERT INTO products (id, category_id, brand_id, name, slug, description, status, featured, featured_until, featured_order, display_order, created_at, updated_at)
SELECT cm.new_product_id, cm.target_category_id, p.brand_id, cm.new_name, cm.new_slug, cm.new_description, p.status, false, NULL, NULL, p.display_order, now(), now()
FROM products p
JOIN clone_map cm ON cm.source_product_id = p.id;

-- 2) Fotos (reaproveita as fotos do produto original)
INSERT INTO product_images (id, product_id, variant_id, url, alt_text, position, created_at, updated_at)
SELECT gen_random_uuid(), cm.new_product_id, NULL, pi.url, pi.alt_text, pi.position, now(), now()
FROM product_images pi
JOIN clone_map cm ON cm.source_product_id = pi.product_id
WHERE pi.variant_id IS NULL;

-- 3) Variantes (mesmo preço/tamanho do original, SKU novo)
INSERT INTO product_variants (id, product_id, sku, title, price, compare_at_price, weight_kg, height_cm, width_cm, depth_cm, is_active, presale_enabled, presale_price, presale_limit, expected_available_at, created_at, updated_at)
SELECT vcm.new_variant_id, vcm.new_product_id, vcm.new_sku, pv.title, pv.price, pv.compare_at_price, pv.weight_kg, pv.height_cm, pv.width_cm, pv.depth_cm, pv.is_active, false, NULL, NULL, NULL, now(), now()
FROM variant_clone_map vcm
JOIN product_variants pv ON pv.id = vcm.source_variant_id;

-- 4) Estoque (mesma quantidade do original)
INSERT INTO inventory (id, variant_id, stock_quantity, reserved_quantity, updated_at)
SELECT gen_random_uuid(), vcm.new_variant_id, inv.stock_quantity, 0, now()
FROM variant_clone_map vcm
JOIN inventory inv ON inv.variant_id = vcm.source_variant_id;

-- 5) Tamanho por variante (clona o vínculo de facet size_apparel de cada variante)
INSERT INTO variant_facet_values (variant_id, facet_value_id)
SELECT vcm.new_variant_id, vfv.facet_value_id
FROM variant_clone_map vcm
JOIN variant_facet_values vfv ON vfv.variant_id = vcm.source_variant_id;

-- 6) Gender no produto novo (clona só a tag gender do original — dress herda "women",
--    shirt herda "unisex" — não clona garment_type do original de propósito, ver abaixo)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT cm.new_product_id, pfv.facet_value_id
FROM product_facet_values pfv
JOIN facet_values fv ON fv.id = pfv.facet_value_id
JOIN facets f ON f.id = fv.facet_id
JOIN clone_map cm ON cm.source_product_id = pfv.product_id
WHERE f.key = 'gender';

-- 7) Cria o valor "shirt" na faceta garment_type (nunca existiu) e tagueia os 4 clones de shirt
INSERT INTO facet_values (id, facet_id, value, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), '42725c8a-c6f3-47e9-8194-0017d308cfce', 'shirt', 'Shirt', 12, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM facet_values WHERE facet_id = '42725c8a-c6f3-47e9-8194-0017d308cfce' AND value = 'shirt'
);

INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT cm.new_product_id, (SELECT id FROM facet_values WHERE facet_id = '42725c8a-c6f3-47e9-8194-0017d308cfce' AND value = 'shirt')
FROM clone_map cm
WHERE cm.kind = 'shirt';

COMMIT;
