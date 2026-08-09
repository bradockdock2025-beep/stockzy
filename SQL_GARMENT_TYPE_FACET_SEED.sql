-- Faceta "garment_type" (tipo de peça: Jersey, T-Shirt, Hoodie, etc.)
--
-- Ver ANALISE_MAPEAMENTO_PLP_JERSEYS.md — "Jersey" não é categoria, é tipo de peça
-- dentro de Apparel > Tops. Mesmo padrão de size_apparel: visibility='category_family',
-- visibility_value='vestuario' (a familyTag já usada por Apparel e suas subcategorias),
-- então só aparece no filtro quando a categoria ativa é de roupa.
--
-- scope='product' (é o produto inteiro que é um "Jersey", não varia por variante,
-- diferente de color/size).
--
-- Pré-requisito: SQL_CATALOG_FACETS_SEED.sql já aplicado.
-- Idempotente: ON CONFLICT DO NOTHING, seguro rodar mais de uma vez.

INSERT INTO facets (id, key, name, input_type, scope, visibility, visibility_value, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.key, v.name, v.input_type::"facet_input_type", v.scope::"facet_scope", v.visibility::"facet_visibility", v.visibility_value, v.sort_order, true, now(), now()
FROM (VALUES
  ('garment_type', 'Category', 'chip', 'product', 'category_family', 'vestuario', 15)
) AS v(key, name, input_type, scope, visibility, visibility_value, sort_order)
ON CONFLICT (key) DO NOTHING;

INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, NULL, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('jersey','Jersey',1),
  ('t-shirt','T-Shirt',2),
  ('hoodie','Hoodie',3),
  ('polo','Polo',4),
  ('tank-top','Tank Top',5),
  ('sweater','Sweater',6)
) AS v(value, label, sort_order)
WHERE f.key = 'garment_type'
ON CONFLICT (facet_id, value) DO NOTHING;
