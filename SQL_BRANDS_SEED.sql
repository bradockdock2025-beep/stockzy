-- Seed de Brands — separado de propósito do SQL_CATALOG_FACETS_SEED.sql
--
-- Marca é dado atrelado a produto real (Product.brandId), não taxonomia estrutural
-- como Facet/FacetValue. Por isso este arquivo roda por último, junto com o cadastro
-- de produto — não junto com a estrutura base do catálogo.
--
-- Fonte: capturas de tela reais do catálogo StockX, usadas como referência/exemplo a
-- pedido explícito — NÃO é o catálogo de marcas definitivo da stockzy. Ajustar/substituir
-- pelas marcas reais quando forem definidas, antes de vincular produtos a elas.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql já aplicado.

INSERT INTO brands (id, name, slug, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, true, now(), now()
FROM (VALUES
  ('361 Degrees','361-degrees'),
  ('adidas','adidas'),
  ('Aime Leon Dore','aime-leon-dore'),
  ('Alexander McQueen','alexander-mcqueen'),
  ('Altra','altra'),
  ('AMIRI','amiri'),
  ('Anta','anta'),
  ('Anti Social Social Club','anti-social-social-club'),
  ('Arc''teryx','arcteryx'),
  ('ASICS','asics'),
  ('Atmos','atmos'),
  ('Autry','autry'),
  ('Awake','awake'),
  ('Axel Arigato','axel-arigato'),
  ('Balenciaga','balenciaga'),
  ('BAPE','bape'),
  ('Billionaire Boys Club','billionaire-boys-club'),
  ('Birkenstock','birkenstock'),
  ('Bottega Veneta','bottega-veneta'),
  ('Brain Dead','brain-dead')
) AS v(name, slug)
ON CONFLICT (slug) DO NOTHING;
