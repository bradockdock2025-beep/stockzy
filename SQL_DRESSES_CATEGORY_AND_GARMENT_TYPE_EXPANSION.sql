-- Ver ANALISE_ESTRUTURA_MEN_WOMEN_SHOP_BY_CATEGORY.md §5 — decisões:
--   1. "Dresses" vira subcategoria nova de Apparel (peça de corpo inteiro, mesmo
--      critério que já separa Tops de Bottoms — não é "tipo dentro de Tops").
--   2. garment_type ganha "jacket"/"coat" pra cobrir "Jackets & Coats" do Shop by
--      Category como filtro de verdade (hoje só a categoria Outerwear cobre, ampla
--      demais pra diferenciar jaqueta de casaco).
--   3. Handbags/Tote Bags NÃO entram agora — sem produto de bolsa cadastrado ainda,
--      mesmo critério de não criar estrutura vazia (ver §4 do mesmo arquivo).
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_CATEGORIES_SEED.sql e
-- SQL_GARMENT_TYPE_FACET_SEED.sql já aplicados.

INSERT INTO categories (id, name, slug, code, parent_id, family_tag, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Dresses', 'dresses', 'DRS', p.id, 'vestuario', true, now(), now()
FROM categories p
WHERE p.slug = 'apparel'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO facet_values (id, facet_id, value, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('jacket','Jacket',7),
  ('coat','Coat',8)
) AS v(value, label, sort_order)
WHERE f.key = 'garment_type'
ON CONFLICT (facet_id, value) DO NOTHING;
