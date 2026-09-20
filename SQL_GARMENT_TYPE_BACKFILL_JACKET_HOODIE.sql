-- Próximo passo depois de SQL_DRESSES_CATEGORY_AND_GARMENT_TYPE_EXPANSION.sql: aquele
-- arquivo só criou a categoria Dresses e os valores "jacket"/"coat" na faceta garment_type
-- (estrutura), mas não vinculou nenhum produto a eles — confirmado ao vivo via
-- GET /catalog/filters?categoryId=<Apparel>: jacket=0, coat=0, hoodie=0 produtos, mesmo
-- havendo 7 produtos reais na categoria Outerwear com esses nomes.
--
-- Este arquivo vincula os 7 produtos reais de Outerwear ao garment_type certo, pelos IDs
-- confirmados via GET /products?categoryId=<Outerwear> contra o banco real em 2026-09-20:
--   2 jackets, 5 hoodies. "coat" continua sem produto (nenhum item de Outerwear é casaco).
--
-- Mesmo padrão de SQL_GARMENT_TYPE_BACKFILL_SWEATPANTS.sql (lista explícita de product_id,
-- não WHERE name LIKE, pra manter o audit trail exato). Idempotente (ON CONFLICT DO NOTHING).
--
-- Pré-requisito: SQL_DRESSES_CATEGORY_AND_GARMENT_TYPE_EXPANSION.sql já aplicado (facet
-- values jacket=6484bae8-bbd5-40ad-b51e-9ec3dd43e8c6, hoodie já existia antes,
-- id 15e53bb4-525b-47c6-8629-4f6b2106de31).

-- Jacket (2 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, '6484bae8-bbd5-40ad-b51e-9ec3dd43e8c6'::uuid
FROM (VALUES
  ('853fd7ce-9f1f-4f20-8742-d8f8c1990f25'::uuid), -- Women's Studded Velour Jacket
  ('2e2c2bba-61b6-4c57-8336-921e1c37cdec'::uuid)  -- Bunny Mechnics Jacket Black/Olive
) AS v(product_id)
ON CONFLICT DO NOTHING;

-- Hoodie (5 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, '15e53bb4-525b-47c6-8629-4f6b2106de31'::uuid
FROM (VALUES
  ('9b305ec7-57e5-436b-8435-c4ddb90d1ddc'::uuid), -- Anthem Pullover Hoodie Black
  ('9cc91554-85f8-4ee6-94d6-35a6247bb853'::uuid), -- Bella McGoldrick x Chelseay Hotel Hoodie
  ('d22a806d-7d6b-4151-a5a0-616dc0abb4bb'::uuid), -- Alta Cienega Zip Up Hoodie Green
  ('8b4aa388-8fc4-4147-8963-e841fdf87432'::uuid), -- Motoslug Zip Hoodie Vintage White
  ('38ad0911-5f03-4f8a-877b-b97c5668ef09'::uuid)  -- Malibu Exclusive Horseshoe Hoodie Black
) AS v(product_id)
ON CONFLICT DO NOTHING;
