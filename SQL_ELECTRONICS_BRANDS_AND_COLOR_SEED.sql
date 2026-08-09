-- Marcas de eletrônicos (ver ANALISE_MAPEAMENTO_ELECTRONICS.md) — nenhuma existia
-- ainda no banco. Vieram do tratamento real de
-- STORAGES_SAMPLE_UPLOAD/Electronics-StockX_files/, não é lista inventada.
--
-- Também adiciona "silver" como novo valor de color — vários produtos deste lote
-- (câmeras Canon/Fujifilm) são prateados e a lista de cores hoje não tem esse valor.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql +
-- SQL_CATALOG_FACETS_SEED.sql já aplicados.

INSERT INTO brands (id, name, slug, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, true, now(), now()
FROM (VALUES
  ('Apple','apple'),
  ('Canon','canon'),
  ('Fujifilm','fujifilm'),
  ('Meta','meta'),
  ('Microsoft','microsoft'),
  ('NVIDIA','nvidia'),
  ('Nintendo','nintendo'),
  ('Sony','sony'),
  ('Valve','valve'),
  ('Teenage Engineering','teenage-engineering'),
  ('finalmouse','finalmouse')
) AS v(name, slug)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO facet_values (id, facet_id, value, label, extra, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, 'silver', 'Silver', '{"hex":"#C0C0C0"}'::jsonb, 13, true, now()
FROM facets f
WHERE f.key = 'color'
ON CONFLICT (facet_id, value) DO NOTHING;
