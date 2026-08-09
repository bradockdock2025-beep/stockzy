-- Faceta "bag_type" — mesmo padrão de garment_type (Apparel) e shoe_height
-- (Sneakers/Shoes), ver docs/frontend-integration/20-comportamento-categorias.md §7.
-- Prepara a estrutura de domínio pra Bags mesmo sem produto ainda cadastrado
-- (decisão: tipo de item é estrutura de domínio, não espera produto real como marca).
--
-- Diferença de garment_type/shoe_height: usa visibility='always' em vez de
-- 'category_family'. Motivo: Accessories não tem family_tag definida (não é uma
-- "família" só de bolsa — inclui Belts, Watches, Jewelry, que já são granulares o
-- bastante sozinhas, ver ANALISE_ESTRUTURA_MEN_WOMEN_SHOP_BY_CATEGORY.md §5). Setar
-- family_tag em Accessories inteira faria essa faceta aparecer (vazia) em
-- subcategorias onde não faz sentido nenhum. 'always' + a regra padrão de "esconde
-- se zerar" já resolve: só aparece de fato quando há produto de bolsa tagueado.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql aplicado.

INSERT INTO facets (id, key, name, input_type, scope, visibility, visibility_value, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'bag_type', 'Category', 'chip'::"facet_input_type", 'product'::"facet_scope", 'always'::"facet_visibility", NULL, 16, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM facets WHERE key = 'bag_type');

INSERT INTO facet_values (id, facet_id, value, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('handbag','Handbag',1),
  ('tote-bag','Tote Bag',2),
  ('backpack','Backpack',3),
  ('crossbody-bag','Crossbody Bag',4),
  ('duffel-bag','Duffel Bag',5)
) AS v(value, label, sort_order)
WHERE f.key = 'bag_type'
ON CONFLICT (facet_id, value) DO NOTHING;
