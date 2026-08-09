# Levantamento — ajustes pendentes na implementação do catálogo facetado

> Gerado em 2026-07-26. Auditoria do que foi implementado nas últimas rodadas (Brand, Facet/FacetValue, ProductFacetValue/VariantFacetValue, banner, homepage, recomendações). Cada item foi confirmado lendo o código atual — não é lista especulativa.

---

## Críticos — campo existe no banco, mas não dá pra escrever via API

### ✅ 1. `Category.familyTag`/`bannerTitle`/`bannerDescription` sem DTO — resolvido (2026-07-26)
Adicionamos essas 3 colunas em `Category` e `isFacetVisible`/`getBanner` **leem** delas (regra `category_family`, banner de `/category/{slug}`). Mas `CreateCategoryDto`/`UpdateCategoryDto` (`src/modules/categories/dto/`) não têm nenhum desses campos, e `CategoriesService.create`/`update` não os grava. **Hoje só dá pra configurar via SQL direto.**

Ajuste: adicionar os 3 campos aos DTOs de categoria + no `data` do `create`/`update` do `CategoriesService`.

### ✅ 2. `FacetValue.bannerTitle`/`bannerDescription` sem DTO — resolvido (2026-07-26)
Mesmo problema: `CreateFacetValueDto`/`UpdateFacetValueDto` (`src/modules/facets/dto/`) não expõem esses campos, embora a coluna exista e `getBanner` leia dela (banner de `/browse/{gender}`). O texto de Men/Women que está no `SQL_CATALOG_FACETS_SEED.sql` só foi possível via SQL manual — pela API, não tem como.

Ajuste: mesma coisa, adicionar aos DTOs de `FacetValue` + no `data` do `createValue`/`updateValue`.

---

## Importante — inconsistência de cache

### ✅ 3. `BrandsService`/`FacetsService` nunca invalidam o cache Redis — resolvido (2026-07-26)
`create`/`update`/`remove` de `Brand`, e `create`/`update`/`remove` de `Facet`/`FacetValue`, nunca chamam `invalidateProductCache()` (o método que já existe em `ProductsService` e que `AttributeOption`/produto sempre chamam depois de mutar). Resultado: renomear uma marca, mudar o label de uma cor, ou desativar uma faceta **não invalida** o cache de `/products` e `/catalog/filters` — quem já tinha isso em cache continua vendo o dado antigo até o TTL expirar (`PRODUCTS_CACHE_TTL_SECONDS`, default 60s).

Não é grave (TTL curto), mas é inconsistente com o padrão que o resto do código já segue.

Ajuste: `BrandsService`/`FacetsService` precisam de acesso a `invalidateProductCache` — como esse método é privado dentro de `ProductsService`, a opção mais simples é extrair a invalidação de cache pra um serviço compartilhado (`RedisService.deleteByPattern('cache:products:*')` já é a chamada de baixo nível) e os três serviços chamarem esse método comum.

---

## Importante — admin não vê o que já está vinculado

### ✅ 4. `findOne`/`findBySlug` não incluem `brand` nem `facetValues` — resolvido (2026-07-26)
`ProductsService.findOne`/`findBySlug` (usados tanto pelo endpoint público quanto por `ProductsAdminController`) não têm `brand: true` nem `facetValues`/`variants.facetValues` no `include`. Um admin abrindo um produto pra editar não vê, na resposta da API, qual marca e quais facetas já estão vinculadas — só vê o que o sistema antigo (`CategoryAttribute`) já mostrava.

Ajuste: adicionar `brand: true` e `facetValues: { include: { facetValue: { include: { facet: true } } } }` (produto) + o equivalente em `variants` no include desses dois métodos.

### ✅ 5. Admin de Homepage Tiles não tem `GET` — resolvido (2026-07-26)
`HomepageAdminController` só tem `POST`/`PATCH`/`DELETE` de tiles — nenhum `GET`. Pra saber o que já existe numa `section` (ex.: quantos tiles já tem em `popular_brands`, incluindo os inativos), só dá pra consultar via `GET /homepage/tiles?section=` público, que filtra `isActive=true` — um tile desativado fica invisível pro admin também.

Ajuste: `GET /admin/homepage/tiles` (com filtro opcional de `section`, sem filtrar `isActive`).

---

## Pra decidir — não são bugs, são lacunas de regra de negócio

### 6. Sem validação de cardinalidade por faceta
Nada impede vincular 2 valores da **mesma** faceta `swatch`/`link` (que sugerem seleção única) numa mesma variante/produto — ex.: `color=black` e `color=white` ao mesmo tempo. `syncProductFacetValues`/`syncVariantFacetValues` só validam existência e `scope`, não quantidade. Pode ser intencional (branding não decidiu se algum dia uma faceta permite múltiplos valores mesmo sendo swatch) — mas vale confirmar.

### 7. Sem guarda-corpo "essa faceta faz sentido pra essa categoria"
Removemos `CategoryFacet` de propósito (era redundante com a regra de visibilidade do storefront). Efeito colateral: no cadastro de produto, nada impede um admin vincular `shoe_height` a um produto da categoria Apparel — o sistema aceita, só não vai aparecer como filtro relevante no storefront (porque `familyTag` não bate). Não quebra nada, mas pode gerar dado "morto"/sem sentido se ninguém prestar atenção no cadastro.

### 8. SKU: prioridade silenciosa entre `attributes` (antigo) e `facetValueIds` (novo)
Se as duas fontes informarem cores diferentes pra mesma variante, o SKU usa só a do sistema antigo (`attributes`), ignorando `facetValueIds` sem avisar. Dado fica possivelmente inconsistente (SKU diz uma cor, o `VariantFacetValue` linkado diz outra). Baixo risco na prática (um admin não deveria preencher os dois sistemas com respostas diferentes), mas vale ter em mente.

---

## Observação (pré-existente, não é da implementação nova)

### 9. `ProductsAdminController.findOne` reusa o `findOne` público, que só mostra `status=active`
Um produto `draft` recém-criado não pode ser visualizado por `GET /admin/products/:id` — dá 404. Isso já existia antes desta rodada, mas fica mais visível agora porque o fluxo de cadastro com `brandId`/`facetValueIds` provavelmente passa por revisar o produto logo depois de criar.

---

## Priorização sugerida

1. ~~Itens 1 e 2 (DTOs de banner)~~ ✅ resolvido
2. ~~Item 4 (findOne com brand/facetValues)~~ ✅ resolvido
3. ~~Item 3 (cache)~~ ✅ resolvido
4. ~~Item 5 (GET de tiles admin)~~ ✅ resolvido
5. Itens 6, 7, 8 — decisões de produto, não bugs; discutir antes de implementar validação (ainda em aberto)
6. Item 9 — fora do escopo desta rodada, só registrado (ainda em aberto, pré-existente)

Itens 1-5 validados ponta a ponta contra Postgres local: categoria com `familyTag`/banner via DTO, FacetValue com banner via DTO, `findOne` retornando `brand`+`facetValues`+`variant.facetValues`, `Brand.update` invalidando o cache de `/products`, e admin vendo tile inativo que o público não vê.
