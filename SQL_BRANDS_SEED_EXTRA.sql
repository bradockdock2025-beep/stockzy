-- Seed de Brands adicionais — descobertas na varredura de STORAGES/ (2026-07-26)
--
-- Complementa SQL_BRANDS_SEED.sql (que só cobria A-B, marcado como "referência/exemplo").
-- Estas 23 marcas vieram do tratamento real de STORAGES/ (scripts/organize-storages.ts,
-- ver STORAGES_MANIFEST.json e PLANO_INSERCAO_PRODUTOS_E_IMAGENS.md secao 1.1/5.4) — não
-- é lista inventada, é o que apareceu de fato nos nomes de arquivo processados.
--
-- Mesmo critério do arquivo original: dado de desenvolvimento/staging, roda junto com
-- a inserção de produto, não com a taxonomia base.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql já aplicado
-- (e SQL_BRANDS_SEED.sql, se quiser evitar rodar os dois fora de ordem — não há
-- dependência real entre eles, `slug` é a única constraint).

INSERT INTO brands (id, name, slug, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.slug, true, now(), now()
FROM (VALUES
  ('Jordan','jordan'),
  ('Nike','nike'),
  ('New Balance','new-balance'),
  ('Swatch','swatch'),
  ('Yeezy','yeezy'),
  ('Sprayground','sprayground'),
  ('Fear of God Essentials','fear-of-god-essentials'),
  ('Supreme','supreme'),
  ('Onitsuka Tiger','onitsuka-tiger'),
  ('Crocs','crocs'),
  ('Bravest Studios','bravest-studios'),
  ('Timberland','timberland'),
  ('Maison MIHARA YASUHIRO','maison-mihara-yasuhiro'),
  ('Louis Vuitton','louis-vuitton'),
  ('Puma','puma'),
  ('Saint Laurent','saint-laurent'),
  ('Eric Emanuel','eric-emanuel'),
  ('Godspeed','godspeed'),
  ('Gymshark','gymshark'),
  ('Kith','kith'),
  ('Palace','palace'),
  ('The North Face','the-north-face'),
  ('UGG','ugg')
) AS v(name, slug)
ON CONFLICT (slug) DO NOTHING;
