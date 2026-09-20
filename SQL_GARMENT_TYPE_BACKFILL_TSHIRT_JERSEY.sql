-- Backfill de garment_type pra categoria Tops (32 produtos reais, confirmados via
-- GET /products?categoryId=<Tops> contra o banco real em 2026-09-20). Mesma lacuna do
-- SQL_GARMENT_TYPE_BACKFILL_JACKET_HOODIE.sql: os valores "t-shirt" e "jersey" já
-- existiam na faceta garment_type (SQL_GARMENT_TYPE_FACET_SEED.sql), mas count=0 —
-- nenhum produto vinculado, mesmo havendo produto real com esse nome.
--
-- Classificado por nome de produto, um a um:
--   t-shirt (22 produtos) — qualquer nome com "T-Shirt"/"T shirt"/"Tee"
--   jersey  (5 produtos)  — qualquer nome com "Jersey"
--
-- 5 produtos de Tops ficaram DE FORA de propósito, sem garment_type ainda — não têm valor
-- de faceta que sirva sem forçar a classificação:
--   'Boy Hurt In Duel Raglan Crewneck Worn White'   (Raglan Crewneck — não é bem t-shirt nem sweater)
--   'Architettura Di Mussolini Lined Raglan Sweatshirt' (Sweatshirt — não existe valor "sweatshirt" na faceta, só "sweater")
--   'Air Force Thermal'                              (Thermal — sem valor na faceta)
--   'Lost Boy Thermal Black'                          (Thermal — sem valor na faceta)
--   'Foti Long Sleeve Shirt White'                    (Shirt ambíguo — já sinalizado em VERIFICACAO-DADOS-SHOP-BY-CATEGORY-BZ.md como candidato incerto a "Shirts" social, não t-shirt)
-- Se quiser cobrir esses 5, precisa antes decidir/criar valor novo (ex. "sweatshirt",
-- "thermal") — não forcei em "sweater" pra não misturar peça errada no filtro.
--
-- Mesmo padrão de SQL_GARMENT_TYPE_BACKFILL_SWEATPANTS.sql (lista explícita de product_id,
-- não WHERE name LIKE, pra manter o audit trail exato). Idempotente (ON CONFLICT DO NOTHING).
--
-- Pré-requisito: SQL_GARMENT_TYPE_FACET_SEED.sql já aplicado
-- (t-shirt=f0310dd8-8b33-40d1-ba99-9f25886096b0, jersey=d9913971-3dbb-4b8d-9dd8-e12526790c2d).

-- T-Shirt (22 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, 'f0310dd8-8b33-40d1-ba99-9f25886096b0'::uuid
FROM (VALUES
  ('8e953340-3da5-492c-891f-2a4159e74dfe'::uuid), -- Women's Madonna Sleeveless T-Shirt Black
  ('ab28e0f5-e9f0-42da-b42d-adc66f2206d9'::uuid), -- Women's Madonna Sleeveless T-Shirt White
  ('fee95494-3007-441a-a175-67339750620c'::uuid), -- Burning Church T-Shirt Burgundy Red
  ('a6bf1d38-a2ce-46c2-a487-2f87593dc085'::uuid), -- Buddhist Uncle T-Shirt Ivory
  ('24cb67f1-6039-459b-970c-a30360dd1e7f'::uuid), -- Broken Dolls Long-Sleeve T-Shirt Black
  ('17f0398d-2eef-48f1-a49c-a07912c48b83'::uuid), -- Bethlehem L/S T-Shirt
  ('0817a05f-9231-4db5-b87f-b02b8ac7beb0'::uuid), -- Anxiety Tee White
  ('ba23cf93-d7a6-4ca7-971b-1b0d33e0a1de'::uuid), -- Paly Bound For Glory Tee Blue
  ('85dff635-b8c4-4a68-93f0-57cadbb39dfa'::uuid), -- Distressed Sleeveless T-Shirt Black
  ('efbe87d2-dfaa-42b7-99ce-5666b385913d'::uuid), -- Split Petrol Logo Mesh LS Tee Vintage WhiteRed
  ('d5186ac2-deb5-4c23-addd-cd1f36b5577b'::uuid), -- Regatta Club T shirt Vintage White
  ('721f77a9-672e-4869-a5fa-f63b178a0f0d'::uuid), -- Montenegro Regatta Tee Vintage BlackNavy
  ('b00db7d7-612b-4322-b02c-95717f1b971e'::uuid), -- Riot Tee
  ('c10f2b1a-ef20-48bc-95e3-e90666dace35'::uuid), -- Kobe Tee
  ('ee9ad010-4d12-47a2-98a7-c0e2a6d19a21'::uuid), -- Hell Tee White
  ('70433c25-e70b-45e4-9a41-98b9716180be'::uuid), -- Bounty Hunter Skulls Tee White
  ('999e8654-ba40-4ea9-88a9-aa6c4572df13'::uuid), -- Alien SS Tee Black
  ('be0e47aa-ca9c-427f-9af6-79f3bea124a1'::uuid), -- School Days Long Sleeve T Shirt Faded BlackWhite
  ('b0430051-d1ea-4a5e-bbb1-6c6ecbf7d9bb'::uuid), -- Womens Vintage Horseshoe Longsleeve T Shirt Black
  ('18889fdb-6983-483f-bd97-79e98a013d11'::uuid), -- Multi Color Cross Cemetery T shirt Black
  ('1e206fd8-b18a-4e66-86b7-56a24613d0e5'::uuid), -- Matty Boy Aspen Floral LS T shirt Black
  ('392c03e7-1725-4d38-9901-bd2ec55c918b'::uuid)  -- Horse Shoe LS T shirt Black Like New
) AS v(product_id)
ON CONFLICT DO NOTHING;

-- Jersey (5 produtos)
INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id, 'd9913971-3dbb-4b8d-9dd8-e12526790c2d'::uuid
FROM (VALUES
  ('ee2ca1b8-323c-46b2-8c98-84441f7b905b'::uuid), -- Mesh Moto Jersey Blue
  ('2208aa4a-7dac-4cc8-b0e5-a11533e27277'::uuid), -- Mesh Moto Jersey Black
  ('8e68dff7-8b3e-45f7-ba72-1142c25ae3ae'::uuid), -- Chrome Hearts x Matty Boy FORM Long Sleeve Jersey Red
  ('76405343-fbef-422a-b6e0-97f25e18cad9'::uuid), -- HMDD Moteaux Jersey White
  ('c3439b09-6803-41e1-92e6-a4b0f18f5d23'::uuid)  -- HMDD Moteaux Jersey Black
) AS v(product_id)
ON CONFLICT DO NOTHING;
