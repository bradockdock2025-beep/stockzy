-- Fase 4 do PLANO_CONSISTENCIA_CATALOGO_FACET.md — passo 2: remoção definitiva.
--
-- Só roda isso DEPOIS de confirmar (via SQL_PHASE4_CHECK_OLD_TABLES.sql) que as 3
-- tabelas estão vazias. O código correspondente (admin de attribute-options, geração de
-- SKU via CategoryAttribute, includes de `attributes` em produto/variante) já foi
-- removido de todo o backend nesta mesma etapa — depois de rodar este script, o sistema
-- de catálogo passa a depender 100% de Facet/FacetValue.
--
-- Ordem de DROP respeita as foreign keys: variant_attribute_values e attribute_options
-- referenciam category_attributes, então saem primeiro.
--
-- IRREVERSÍVEL — não há como desfazer isso além de restaurar um backup. Se tiver dúvida,
-- roda o CHECK de novo antes.

DROP TABLE IF EXISTS variant_attribute_values;
DROP TABLE IF EXISTS attribute_options;
DROP TABLE IF EXISTS category_attributes;
