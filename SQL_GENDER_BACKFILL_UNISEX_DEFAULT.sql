-- Resolve o gap de "Men's Collection" no back, sem fabricar dado.
--
-- Contexto: não existe UM produto sequer com "Men's"/"Mens" explícito no nome (confirmado
-- via busca no catálogo inteiro) — diferente de "women" (10 produtos com "Women's" no
-- nome, cobertos por SQL_GENDER_BACKFILL_WOMEN.sql) e "kids" (5 sneakers com sinal de
-- tamanho infantil, GS/PS, já taggeados). Marcar 260+ produtos como gender:men sem sinal
-- nenhum seria inventar dado que não existe, não extrair dado real — errado tanto pra
-- correção do catálogo quanto pra confiança do filtro no front.
--
-- Solução correta: a faceta gender já tem um valor feito exatamente pra isso — "unisex".
-- Não é chute, é a classificação certa: produto sem indicação de exclusividade de gênero
-- (a esmagadora maioria deste catálogo de streetwear — Chrome Hearts, Supreme, Rhude,
-- Satoshi Nakamoto etc. — é vendida e usada por qualquer gênero, sem corte específico) É
-- unisex por definição, não "men por padrão".
--
-- Isso resolve o filtro dos dois lados:
--   "Women's Collection" → GET /products?facets=gender:women            (10 produtos reais, sinal explícito)
--   "Men's Collection"   → GET /products?facets=gender:men|unisex       (retorna os unisex — filtro já suporta
--                                                                        múltiplos valores por "|", ver
--                                                                        parseFacetFilters em products.service.ts;
--                                                                        se um produto realmente exclusivo de
--                                                                        homem entrar no catálogo no futuro,
--                                                                        basta taguear gender:men nele e ele
--                                                                        aparece também, sem mudar a query)
--
-- Escopo: 263 produtos ativos SEM nenhuma tag de gender hoje (confirmado por COUNT(*) ao
-- vivo em 2026-09-20, catálogo inteiro — Apparel, Accessories e Sneakers, os 3 únicos
-- com produto). Por isso este arquivo usa SELECT dinâmico (INSERT ... SELECT ... WHERE NOT
-- EXISTS), diferente do padrão de lista explícita de UUID dos outros backfills — aqui não
-- é uma classificação inferida por nome (que exigiria auditoria item a item), é uma regra
-- objetiva e verificável ("todo produto ativo sem tag de gênero vira unisex"), então a
-- query já é o audit trail.
--
-- Idempotente (ON CONFLICT DO NOTHING + WHERE NOT EXISTS). Rode depois de
-- SQL_GENDER_BACKFILL_WOMEN.sql (senão os 4 produtos daquele arquivo também cairiam aqui
-- como unisex, por ainda não terem tag de gender no momento em que este rodar).
--
-- Pré-requisito: SQL_CATALOG_FACETS_SEED.sql já aplicado
-- (gender:unisex = d5b9bf28-a147-4e0e-a132-567f1b5031d6).

INSERT INTO product_facet_values (product_id, facet_value_id)
SELECT p.id, 'd5b9bf28-a147-4e0e-a132-567f1b5031d6'::uuid
FROM products p
WHERE p.status = 'active'
AND NOT EXISTS (
  SELECT 1
  FROM product_facet_values pfv
  JOIN facet_values fv ON fv.id = pfv.facet_value_id
  JOIN facets f ON f.id = fv.facet_id
  WHERE pfv.product_id = p.id AND f.key = 'gender'
)
ON CONFLICT DO NOTHING;
