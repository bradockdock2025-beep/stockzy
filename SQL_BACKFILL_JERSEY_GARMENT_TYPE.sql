-- Backfill: aplica a tag garment_type nos 38 produtos de jersey já criados
-- (SEED_JERSEYS_REPORT.json), rodado ANTES de SQL_GARMENT_TYPE_FACET_SEED.sql existir.
-- Idempotente: ON CONFLICT DO NOTHING (chave composta product_id+facet_value_id).

INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT v.product_id::uuid, fv.id
FROM (VALUES
  ('dea10aaa-4147-4f84-86a4-7bd34b5da69f', 'jersey'),
  ('199113f4-cde4-4b07-b74b-5750d9fadf5a', 'jersey'),
  ('7a8339ba-bd28-44a0-8cb7-2b21a171f53c', 'jersey'),
  ('0759d170-ad2a-48a0-9369-13e7b035b713', 'jersey'),
  ('5a460f5a-ff25-49f6-a538-733c7e0165bb', 'jersey'),
  ('d6d1c051-e992-4d2f-b1d0-76d1dd65faa5', 'jersey'),
  ('1d187a98-396d-4c23-8e59-b7de5bbd10ed', 't-shirt'),
  ('601bdec1-29b4-451f-8e8c-f2f7ad7e0dba', 'jersey'),
  ('bc77b795-ed63-481a-a253-4ec77a7930da', 'jersey'),
  ('f51d2e99-cf06-43ad-90c8-4702755ad4e5', 'jersey'),
  ('bcae5790-bc80-4e38-85a0-7c287d0c5708', 'jersey'),
  ('7c2ea98f-5abf-44a8-8708-88aaae35ac15', 'jersey'),
  ('07caf279-d6da-41f0-9b25-0b43deacae8b', 'jersey'),
  ('9d94570a-50bc-47d9-8cee-faf6796fca9a', 'jersey'),
  ('eafea53a-32f1-4a4e-b6d4-9eb9fc0554f9', 'jersey'),
  ('cd3c14ac-d541-4ca2-89d3-7e749528fcb4', 'jersey'),
  ('465042b7-abb2-4f14-a62c-8cdc8bb27b43', 'jersey'),
  ('2afd902f-6cf2-41df-aa92-2a568bfd5c79', 'jersey'),
  ('87b08b0e-c2e2-4555-a88d-b55987776f02', 'jersey'),
  ('73f23c07-af51-4ca3-a098-786066a3ea65', 'jersey'),
  ('1f76f3ba-ab09-4936-b4af-a95793db8147', 'jersey'),
  ('f0b032ab-6986-4d9c-8392-632f4cc62845', 'jersey'),
  ('91e6fe38-8fe9-42dd-8189-da2e3ba1e3cf', 'jersey'),
  ('c03ecd20-924b-42b6-935b-d42bbf33a18b', 'jersey'),
  ('eba4e231-b760-49e5-a393-20c568d08614', 'jersey'),
  ('eabbaad1-5201-49a5-96a3-fa59bafaee6d', 'jersey'),
  ('881c2663-756f-446c-a94b-f60caa416cec', 'jersey'),
  ('9c6fcdde-3442-4069-a8fc-ba9be2b722f8', 'jersey'),
  ('08861681-4998-45fc-a042-24e3dc07495d', 'jersey'),
  ('6822b00b-0c3f-4e37-a1ed-d0b7f7a8b439', 'jersey'),
  ('6d777bd3-4b1f-4607-a344-57a412009f85', 'jersey'),
  ('5c87852b-6e72-48ec-8efd-d767fa622593', 'jersey'),
  ('15c9c1de-38dd-44eb-8544-0d42b57038ab', 'jersey'),
  ('edf1725d-bb76-4388-9a8f-dfcc0a8e04b0', 'jersey'),
  ('541b046a-6f44-45fa-b268-b9995cc9539c', 'jersey'),
  ('776cf3c7-ab95-42f2-8c1f-e56ba0dc5871', 'jersey'),
  ('82f77abc-b6e6-452c-9257-6cc182e8c2c3', 'jersey'),
  ('957a69b9-a201-4dba-8de8-0a97170366aa', 'jersey')
) AS v(product_id, garment_type_value)
JOIN facets f ON f.key = 'garment_type'
JOIN facet_values fv ON fv.facet_id = f.id AND fv.value = v.garment_type_value
ON CONFLICT DO NOTHING;
