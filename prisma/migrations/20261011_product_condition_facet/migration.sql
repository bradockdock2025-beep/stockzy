-- ANALISE-CONDICAO-PRODUTO-2026-10-11.md — facet novo "Condition" (New/Like New/
-- Used – Good/Used – Fair), reaproveitando o sistema de facets já existente em vez de
-- uma coluna dedicada. Cria o facet + os 4 valores, e faz backfill: todo produto que já
-- existe no catálogo (presumivelmente estoque próprio, novo) fica ligado a "New".
-- Produtos publicados a partir de submissão de vendedor, dali em diante, recebem o
-- valor certo no momento da publicação (seller-submissions.service.ts, publish()).

DO $$
DECLARE
  v_facet_id UUID;
  v_new_id UUID;
  v_like_new_id UUID;
  v_used_good_id UUID;
  v_used_fair_id UUID;
BEGIN
  INSERT INTO "facets" ("id", "key", "name", "input_type", "scope", "visibility", "is_active")
  VALUES (gen_random_uuid(), 'condition', 'Condition', 'chip', 'product', 'always', true)
  RETURNING "id" INTO v_facet_id;

  INSERT INTO "facet_values" ("id", "facet_id", "value", "label", "sort_order", "is_active")
  VALUES (gen_random_uuid(), v_facet_id, 'new', 'New', 1, true)
  RETURNING "id" INTO v_new_id;

  INSERT INTO "facet_values" ("id", "facet_id", "value", "label", "sort_order", "is_active")
  VALUES (gen_random_uuid(), v_facet_id, 'like_new', 'Like New', 2, true)
  RETURNING "id" INTO v_like_new_id;

  INSERT INTO "facet_values" ("id", "facet_id", "value", "label", "sort_order", "is_active")
  VALUES (gen_random_uuid(), v_facet_id, 'used_good', 'Used – Good', 3, true)
  RETURNING "id" INTO v_used_good_id;

  INSERT INTO "facet_values" ("id", "facet_id", "value", "label", "sort_order", "is_active")
  VALUES (gen_random_uuid(), v_facet_id, 'used_fair', 'Used – Fair', 4, true)
  RETURNING "id" INTO v_used_fair_id;

  -- Backfill: todo produto já existente, sem condição nenhuma ainda, fica "New".
  INSERT INTO "product_facet_values" ("product_id", "facet_value_id")
  SELECT "id", v_new_id FROM "products";
END $$;
