-- Corrige a faceta size_apparel: estava com visibilidade fixa por família (category_family
-- + visibility_value='vestuario'), inconsistente com size_men/size_women/size_kids (que
-- são dinâmicos, visibility='always' — some da resposta sozinho se a contagem zerar).
-- Ver ANALISE_CONSISTENCIA_SISTEMA.md item 2.3.
--
-- Necessário porque SQL_CATALOG_FACETS_SEED.sql usa ON CONFLICT DO NOTHING — só re-rodar
-- o arquivo não corrige uma linha que já existe com o valor errado, precisa de UPDATE.
-- Idempotente (WHERE já filtra pelo estado antigo, rodar de novo não faz nada na segunda vez).

UPDATE facets
SET visibility = 'always', visibility_value = NULL
WHERE key = 'size_apparel' AND visibility = 'category_family';
