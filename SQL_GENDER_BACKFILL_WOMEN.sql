-- Backfill da faceta gender — parte segura (lado "women"), pra "Women's Collection" do
-- template BZ. Confirmado ao vivo (GET /products?search=women contra o banco real,
-- 2026-09-20): existem 10 produtos com "Women's"/"Womens" explícito no nome, mas só 6 já
-- tinham a tag gender:women aplicada (5 sneakers + "Womens Vintage Horseshoe Longsleeve
-- T Shirt Black"). Os 4 abaixo têm o mesmo sinal textual claro no nome e ainda não tinham
-- sido pegos porque não apareceram na varredura anterior por categoria (2 deles são
-- "Sweatpants" no nome, que a varredura de Bottoms tinha excluído de propósito por já
-- estarem cobertos pelo garment_type=sweatpants; o critério aqui é outro, é gênero, não
-- tipo de peça).
--
-- Mesmo padrão dos backfills de garment_type: lista explícita de product_id, sem WHERE
-- name LIKE, idempotente (ON CONFLICT DO NOTHING).
--
-- Pré-requisito: SQL_CATALOG_FACETS_SEED.sql já aplicado
-- (gender:women = 990e8ae5-82e2-485b-89bc-15b8a5e5ace8).
--
-- NOTA: isso cobre só o lado "women". O lado "men" NÃO tem sinal textual equivalente no
-- catálogo (busca por "men"/"mens" só retorna os mesmos produtos "Women's" por
-- substring) — taguear produto como gender:men exigiria decisão de negócio produto a
-- produto, não é algo que dá pra inferir do nome. Ver conversa — aguardando decisão antes
-- de gerar esse SQL.

INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, '990e8ae5-82e2-485b-89bc-15b8a5e5ace8'::uuid
FROM (VALUES
  ('8e953340-3da5-492c-891f-2a4159e74dfe'::uuid), -- Women's Madonna Sleeveless T-Shirt Black
  ('ab28e0f5-e9f0-42da-b42d-adc66f2206d9'::uuid), -- Women's Madonna Sleeveless T-Shirt White
  ('c7f7d362-ddc9-4bb8-b52b-8f077ed03989'::uuid), -- Women's Studded Velour Sweatpants
  ('853fd7ce-9f1f-4f20-8742-d8f8c1990f25'::uuid)  -- Women's Studded Velour Jacket
) AS v(product_id)
ON CONFLICT DO NOTHING;
