# Plano — Tornar o backend consistente com o catálogo facetado (Facet/FacetValue)

> Gerado em 2026-07-26. Contexto: reconstruímos `GET /products` e `GET /catalog/filters` sobre um modelo novo (`Brand`, `Facet`, `FacetValue`, `ProductFacetValue`, `VariantFacetValue`), mas o cadastro de produto no admin (`ProductsService.create`/`update`) e a geração de SKU continuam 100% no modelo antigo (`CategoryAttribute`/`AttributeOption`/`VariantAttributeValue`). Isso deixa dois sistemas paralelos que não se falam — nenhum produto cadastrado hoje aparece filtrável no storefront, porque nada escreve em `ProductFacetValue`/`VariantFacetValue`. Este documento planeja fechar essa lacuna, deixando **um único sistema consistente**, sem duplicidade.

---

## 1. Estado atual (confirmado por grep no código)

| Caminho | Sistema usado |
|---|---|
| `GET /products`, `GET /catalog/filters`, `GET /catalog/banner` (storefront) | `Facet`/`FacetValue`/`ProductFacetValue`/`VariantFacetValue` |
| `ProductsService.create`/`update` (admin, cadastro de produto) | `CategoryAttribute`/`AttributeOption`/`VariantAttributeValue` |
| Geração de SKU (`generateSkuBase`, `colorAttributeIds`, `sizeAttributeIds`, `getAttributeValue`) | `CategoryAttribute` por nome ("Cor", "Tamanho") |
| `ProductFacetValue`/`VariantFacetValue` | **Nunca escritos em nenhum lugar do código** |
| CRUD de `Brand`/`Facet`/`FacetValue` | **Não existe** — só via SQL direto |

Resultado prático: hoje é impossível, usando só a API, cadastrar um produto que apareça nos filtros novos.

---

## 2. Estado-alvo

Um único sistema. `Facet`/`FacetValue` (+ `Brand`) passam a ser a **fonte da verdade** tanto pra navegação do storefront quanto pro cadastro no admin e a geração de SKU. `CategoryAttribute`/`AttributeOption`/`VariantAttributeValue` deixam de ser escritos por qualquer fluxo novo — ficam congelados (não apagados ainda) até confirmar que nada mais depende deles, e só então são removidos.

---

## 3. Plano em fases

### ✅ Fase 1 — CRUD admin de Brand/Facet/FacetValue (concluída 2026-07-26)
- `BrandsAdminController`/`BrandsService` (`/admin/brands`): create/findAll/findOne/update/deactivate
- `FacetsAdminController`/`FacetsService` (`/admin/facets` + `/admin/facets/:facetId/values`): CRUD de Facet + FacetValue aninhado, com validação de `visibilityValue` obrigatório quando `visibility` exige
- Validado ponta a ponta contra Postgres local (create/find/update/deactivate de Brand e Facet, rejeição correta de `visibility` sem `visibilityValue`)

### ✅ Fase 2 — Cadastro de produto passa a gravar Facet também (concluída 2026-07-26)
**Decisão tomada durante a implementação, diferente do que este plano previa originalmente**: em vez de *substituir* `attributes`/`CategoryAttribute` por `facetValueIds`, implementei de forma **aditiva** — `attributes` (sistema antigo) continua existindo e funcionando exatamente como antes; `facetValueIds` (novo, opcional) foi adicionado em paralelo em `CreateProductDto`/`CreateVariantDto`/`UpdateVariantDto`. Motivo: uma substituição completa nesta fase quebraria a geração de SKU (que só seria endereçada na Fase 3), violando a regra de não quebrar fluxo de compra existente.

- `ProductsService.create`/`update`: gravam `ProductFacetValue` (produto, scope=product) e `VariantFacetValue` (variante, scope=variant) quando `facetValueIds` é enviado, dentro da mesma transação
- Validação: rejeita `facetValueIds` que não existem ou que referenciam facet do scope errado (produto vs. variante)
- `brandId` também virou aditivo em `CreateProductDto`/`UpdateProductDto`
- Validado ponta a ponta: create com brand+facetValueIds, rejeição de scope errado, update limpando/trocando facetValueIds do produto e de variante existente, update adicionando variante nova com facetValueIds

### ✅ Fase 3 — SKU com fallback pra FacetValue (concluída 2026-07-26)
**Mesma decisão de ser aditivo, não substituir**: `getSkuFacetInfo`/`getFacetSkuValue` (novos) resolvem cor/tamanho a partir de `Facet`/`FacetValue` quando o `CategoryAttribute` correspondente não existir pra aquela categoria. A condição que decide se o SKU precisa de sufixo de cor passou de `colorAttributeIds.size > 0` para `colorAttributeIds.size > 0 || !!skuFacetInfo.colorFacetId` — ou seja, uma categoria só-Facet também gera sufixo de cor/tamanho no SKU, sem precisar ter `CategoryAttribute` cadastrado.

- Validado ponta a ponta: categoria só-Facet gera `SKU-BLACK-8`; categoria só-CategoryAttribute continua gerando exatamente igual a antes (zero regressão); categoria sem nenhuma fonte de cor continua rejeitando corretamente

### ✅ Fase 4 — Descontinuar o sistema antigo (concluída 2026-07-28)
Validado em produção (36 produtos reais cadastrados via `facetValueIds`, aparecendo certo em `GET /products`/`GET /catalog/filters` com dado real, sessão anterior) antes de prosseguir.

- Removido `attribute-options.admin.controller.ts` + `dto/attribute-options-admin.dto.ts` (arquivos inteiros) e as 4 rotas `/admin/attribute-options*`
- Removidos `listAttributeOptions`/`createAttributeOption`/`updateAttributeOptionStatus`/`removeAttributeOption`/`validateVariantAttributes`/`isValidAttributeValue`/`getAttributeValue` de `products.service.ts`
- `create()`/`update()` simplificados: `hasColorSource` passa a ser só `!!skuFacetInfo.colorFacetId` (sem fallback pro `CategoryAttribute`)
- `CreateVariantDto`/`UpdateVariantDto` perderam o campo `attributes`
- **Achado durante a execução, fora do escopo original desta fase**: `notifications.service.ts`, `orders/receipt.service.ts` (emails/PDF de pedido, mostravam "Cor: Preto · Tamanho: 42" via `CategoryAttribute`) e `search/search.service.ts` (endpoint `GET /search`, filtros `cor`/`marca`/`tamanho`/`attributes` + sidebar facetada, tudo via SQL raw contra `variant_attribute_values`/`category_attributes`) também dependiam do sistema antigo — nenhum desses tinha sido migrado durante a reconstrução do catálogo. Portados pro sistema de Facet/Brand (não só removidos): emails/recibo agora usam `VariantFacetValue`; busca agora usa `brand` (Brand real) + `facets` (mesmo formato `key:val1|val2` do catálogo), com sidebar de auto-exclusão via Facet/FacetValue. Filtro de range numérico de tamanho (`tamanho=38-40`) da busca antiga não tem equivalente direto no novo formato (exact-match, como o resto do sistema) — removido, não portado.
- `schema.prisma`: removidos os models `CategoryAttribute`/`AttributeOption`/`VariantAttributeValue` e as relações reversas em `Category`/`ProductVariant`
- `SQL_FULL_SCHEMA.sql` regenerado (41 tabelas, era 44) — safe pra instalação nova. Pro banco real (que já tem as 3 tabelas antigas), gerados `SQL_PHASE4_CHECK_OLD_TABLES.sql` (confirma que estão vazias) + `SQL_PHASE4_DROP_OLD_TABLES.sql` (remove, na ordem certa de FK)
- Validado ponta a ponta contra Postgres local: `create()` (36 produtos), `update()` (3 cenários: campo simples, variante existente com facetValueIds, variante nova com SKU auto-gerado), sidebar de busca (SQL raw testado direto), CHECK+DROP (testado contra tabelas reconstruídas do schema antigo, via git history) — zero erro em tudo
- `npx tsc --noEmit` limpo (zero erros) em todo o projeto depois da remoção

---

## 4. Decisões em aberto

1. **Produtos já cadastrados hoje** (via sistema antigo) — como combinado antes, **não vamos migrar/backfillar** esses dados pro novo sistema. Continua valendo.
2. ~~Validação de obrigatoriedade por categoria~~ — **resolvido pela abordagem aditiva**: como `attributes`/`CategoryAttribute.isRequired` continuam funcionando exatamente como antes, a obrigatoriedade (quando existe) já é aplicada pelo sistema antigo. `facetValueIds` é sempre opcional — não introduz nem remove obrigatoriedade nenhuma.
3. ~~Fase 4 (apagar tabelas antigas)~~ — **concluída** (código já não depende mais das 3 tabelas antigas; falta só você rodar `SQL_PHASE4_CHECK_OLD_TABLES.sql` + `SQL_PHASE4_DROP_OLD_TABLES.sql` manualmente no banco real).

## 5. Fora de escopo deste plano
- Migração/backfill de dado antigo pro novo modelo (decisão já tomada antes)
- UI de admin (frontend) — este plano é só backend/API

---

## 6. Estado atual e próximo passo

Fases 1, 2, 3 e 4 implementadas e validadas (Postgres local + banco real de produção). O backend depende 100% de `Facet`/`FacetValue`/`Brand` — não sobrou nenhum código lendo/escrevendo `CategoryAttribute`/`AttributeOption`/`VariantAttributeValue`.

**Único passo que falta**: você rodar manualmente no banco real, nessa ordem:
1. `SQL_PHASE4_CHECK_OLD_TABLES.sql` — confirma que as 3 tabelas antigas estão vazias (esperado: sim)
2. `SQL_PHASE4_DROP_OLD_TABLES.sql` — remove as 3 tabelas de vez (irreversível)

Depois disso, `SQL_FULL_SCHEMA.sql` volta a bater 100% com o banco real (41 tabelas).
