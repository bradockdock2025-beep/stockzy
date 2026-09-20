-- Último passo pra fechar o "Shop by Category" do lado Apparel (depois de
-- SQL_GARMENT_TYPE_BACKFILL_JACKET_HOODIE.sql e SQL_GARMENT_TYPE_BACKFILL_TSHIRT_JERSEY.sql,
-- ambos já compilados no banco): categoria Bottoms tem 137 produtos, dos quais 119 já são
-- sweatpants taggeados — os outros 21 (track pants, cargo, trousers, jeans, shorts) não
-- têm valor de garment_type nenhum, porque "pants" e "shorts" NUNCA existiram na faceta
-- (só "sweatpants" foi criado, em SQL_GARMENT_TYPE_ADD_SWEATPANTS.sql).
--
-- Diferente dos backfills anteriores, este arquivo faz duas coisas: cria os 2 valores
-- novos na faceta garment_type, e já tagueia os produtos reais na mesma execução (via
-- subquery, sem precisar hardcodar o UUID novo — mais seguro que gerar o id e colar à mão).
--
-- Classificado por nome de produto, confirmado via GET /products?categoryId=<Bottoms>
-- contra o banco real em 2026-09-20:
--   pants  (13 produtos) — track pant(s), trackpants, cargo pants, painters pant,
--                          trousers, e os 2 jeans (calça jeans é pants, sem tile
--                          separado de "Jeans" no print)
--   shorts (8 produtos)  — leather shorts (2 produtos distintos, mesmo nome),
--                          twill short, champ shorts (4 cores), brazil shorts
--
-- Idempotente (ON CONFLICT DO NOTHING nos dois passos). Pré-requisito: facet garment_type
-- já existente (id 42725c8a-c6f3-47e9-8194-0017d308cfce, mesma usada em
-- SQL_GARMENT_TYPE_ADD_SWEATPANTS.sql).

-- 1) Cria os 2 valores novos
INSERT INTO facet_values (id, facet_id, value, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), '42725c8a-c6f3-47e9-8194-0017d308cfce', v.value, v.label, v.sort_order, true, now()
FROM (VALUES
  ('pants', 'Pants', 10),
  ('shorts', 'Shorts', 11)
) AS v(value, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM facet_values WHERE facet_id = '42725c8a-c6f3-47e9-8194-0017d308cfce' AND value = v.value
);

-- 2) Pants (13 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, (SELECT id FROM facet_values WHERE facet_id = '42725c8a-c6f3-47e9-8194-0017d308cfce' AND value = 'pants')
FROM (VALUES
  ('b131f449-cd02-4d09-86b6-d0a64e0de8c5'::uuid), -- Supreme Umbro Gradient Track Pant Navy
  ('a7418896-37f4-47e6-9a42-6c21421da491'::uuid), -- Supreme Jordan Track Pant (SS26) White
  ('3126f2e4-c4c7-4f24-bc92-f8314fb49b05'::uuid), -- Supreme Jordan Track Pant (SS26) Black
  ('8524497b-b1df-45f7-b048-498110637d62'::uuid), -- Rick Owens Brown Bauhaus Cargo Pants
  ('52871ee6-f752-4bbc-b624-5e7bc4d63a71'::uuid), -- Rhude Hampton Track Pants Black
  ('8fccaaef-0fa7-486b-b33f-25087f0d18a8'::uuid), -- Killtec Star Track Pants
  ('1cf307a8-7957-4261-9d78-5e8a93d58872'::uuid), -- Killtec Kt Star Maroon Trackpants
  ('83bc2ac3-1c8a-44a7-895f-4a862aebd21a'::uuid), -- Godspeed GRC Trackpants White
  ('7c7abf6b-a7e0-4bea-a36d-b0112aa9fcca'::uuid), -- Godspeed GRC Trackpants Black
  ('e7d1d8cc-4640-431c-844f-024e1a32ddee'::uuid), -- Allstar Jeans Blue
  ('f25c3086-5e06-4f1f-a349-6fa2110ad1a5'::uuid), -- Allstar Jeans Black
  ('732b874c-7e40-4913-92ec-5f73e296cf5f'::uuid), -- 1980's Painters Pant Black
  ('f19d42af-3d33-477e-bd5c-1f28360d85c4'::uuid)  -- Black Temple Bela Trousers
) AS v(product_id)
ON CONFLICT DO NOTHING;

-- 3) Shorts (8 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, (SELECT id FROM facet_values WHERE facet_id = '42725c8a-c6f3-47e9-8194-0017d308cfce' AND value = 'shorts')
FROM (VALUES
  ('84b01c7f-4aa8-4f6b-aa95-77f3e93dade5'::uuid), -- Leather Shorts Brown
  ('5d2926fa-4400-455d-92de-71c96c0d2625'::uuid), -- Classic Logo Twill Short NavyWhite
  ('195e8ecf-4a72-4460-869b-bc82ef7d48a8'::uuid), -- Eric Emanuel x New York Knicks Champ Shorts WhiteGold
  ('f3caf065-3c54-4863-86e1-1da9991cb2fe'::uuid), -- Eric Emanuel x New York Knicks Champ Shorts OrangeGold
  ('7af725fb-14cd-4b30-848c-9e038cfd1bc5'::uuid), -- Eric Emanuel x New York Knicks Champ Shorts BlueGold
  ('4490bce7-1fbd-40fe-b881-7604c3180418'::uuid), -- Eric Emanuel x New York Knicks Champ Shorts BlackGold
  ('bce277ad-2327-408a-8645-1fe79a50847e'::uuid), -- Leather Shorts Brown (2º produto, mesmo nome)
  ('6c731609-b2a8-4397-827c-aca4f38ae29c'::uuid)  -- Brazil 34 Shorts
) AS v(product_id)
ON CONFLICT DO NOTHING;
