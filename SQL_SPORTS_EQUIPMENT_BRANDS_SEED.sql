-- Marcas novas pro lote de Sports Equipment (Collectibles > Sports Equipment).
-- adidas/Jordan/Nike/Kith/Supreme já existem — só faltam estas 4, vieram do
-- tratamento real de STORAGES_SAMPLE_UPLOAD/Sports-Equipment-StockX_files/.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql aplicado.

INSERT INTO brands (id, name, slug, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, true, now(), now()
FROM (VALUES
  ('Odyssey','odyssey'),
  ('Spalding','spalding'),
  ('Stanley','stanley'),
  ('Selkirk','selkirk')
) AS v(name, slug)
ON CONFLICT (slug) DO NOTHING;
