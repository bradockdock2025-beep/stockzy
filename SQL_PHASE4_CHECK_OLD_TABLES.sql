-- Fase 4 do PLANO_CONSISTENCIA_CATALOGO_FACET.md — passo 1: verificação de segurança.
--
-- Roda ISSO ANTES de SQL_PHASE4_DROP_OLD_TABLES.sql. Confirma que as 3 tabelas do
-- sistema antigo de atributos estão vazias (esperado: sim, já que nada nesta stockzy
-- nova jamais escreveu nelas — todo produto foi cadastrado direto via Facet/FacetValue).
-- Se alguma contagem vier > 0, PARE e me avise antes de rodar o drop — significa que
-- existe dado real lá que a gente não esperava.

SELECT
  (SELECT count(*) FROM category_attributes)   AS category_attributes,
  (SELECT count(*) FROM attribute_options)     AS attribute_options,
  (SELECT count(*) FROM variant_attribute_values) AS variant_attribute_values;
