# Análise — aderência da implementação ao `buildingConcept/`

> Gerado em 2026-07-28. Só análise, nada foi executado/alterado. Li os 11 arquivos de `buildingConcept/` (CONCEPT.md, BACKEND-ARCHITECTURE.md, BACKEND-CONCEPT.md, BACKEND-ENDPOINT-PRODUCTS.md, BACKEND-ENDPOINT-CATALOG-FILTERS.md, PAGE-BROWSE-MEN.md, PAGE-CATEGORY-SNEAKERS.md, PAGE-CATEGORY-SHOES.md, PAGE-CATEGORY-ACCESSORIES.md, PAGE-CATEGORY-APPAREL.md, ROUTES-AND-FILTERS.md) e cruzei com o código atual (`products.service.ts`, `filters.controller.ts`, `categories.controller.ts`, DTOs, seed de facets).

---

## 1. O que está de acordo — os pontos centrais do conceito

| Regra do `buildingConcept/` | Onde | Status |
|---|---|---|
| Dois endpoints separados (`/products` = grid, `/catalog/filters` = sidebar), evita recalcular sidebar à toa | `products.controller.ts` + `filters.controller.ts` | ✅ |
| Cada faceta se auto-exclui do próprio cálculo de contagem | `getFilters()`, `buildFacetFragments` | ✅ — validado com dado real nesta sessão |
| Entre facetas diferentes = E; entre valores da mesma faceta = OU | `buildVariantFilters`/`buildFacetFragments` (`some: {facetValueId: {in: [...]}}`) | ✅ |
| Faceta some da resposta se toda contagem zerar (regra corrigida em PAGE-CATEGORY-ACCESSORIES) | `getFilters()`: `if (!counts.some(c => c.count > 0)) continue` | ✅ |
| Gender não é categoria, é valor de faceta (`Gender / Men`, não `Category / Men`) | `Facet` `gender`, scope=product | ✅ |
| Regra `facet_rules`/`visible_when` como dado, não `if` fixo | `Facet.visibility` + `Facet.visibilityValue` + `isFacetVisible()` | ✅ |
| Gender some quando já vem fixo na requisição | `visibility: gender_fixed_absent` | ✅ |
| Shoe Height só quando categoria é família "calçado" | `visibility: category_family`, `visibilityValue: calcado` | ✅ |
| Age Group só quando `gender=kids` já é filtro ativo | `visibility: gender_equals`, `visibilityValue: kids` | ✅ |
| Men's/Women's/Kid's Size — dinâmico (conta e some se zerar), **não** fixo por família | `size_men`/`size_women`/`size_kids`: `visibility: always` | ✅ — bate com a correção feita em PAGE-CATEGORY-ACCESSORIES |
| Os 3 blocos de Size aparecem juntos, sem depender de Gender estar filtrado | `visibility: always` nos 3 | ✅ |
| Category mostra lista raiz ou filhos, conforme onde você está na árvore | `getFilters()`: `parentId: query.categoryId ?? null` | ✅ |
| Price min/max calculado sobre o filtro **completo**, sem exceção (diferente das outras facetas) | `priceStats` usa `fullVariantFilters` (todos os fragmentos, sem excluir nada) | ✅ |
| Sem "patrocinado" como leilão — campo fixo tipo "em destaque: sim/não" | `Product.featured: boolean` | ✅ |
| Sem preço duplo (ask + incl. fees) | `ProductVariant.price` único | ✅ |
| `available_now` → em estoque | `QueryProductDto.inStock` | ✅ |
| `below_retail` → preço atual abaixo do compareAtPrice | `QueryProductDto.belowRetail` | ✅ |

O núcleo do sistema (a parte mais difícil de acertar — auto-exclusão + visibilidade condicional) está implementado e validado corretamente.

---

## 2. Gaps reais — endpoints/comportamento que o doc pede e não existe (ou existe incompleto)

### 2.1 `GET /categories` é admin-only — bloqueia o menu público
**Isso é o achado mais sério.** `BACKEND-CONCEPT.md` é explícito: `GET /categories` "alimenta o menu principal do header e a lista do filtro CATEGORY" — ou seja, precisa ser público. Hoje:

```ts
@Controller('categories')
@Roles(user_role.admin, user_role.manager)   // categories.controller.ts:12
```

O controller inteiro (incluindo os `GET`) exige JWT de admin/manager — sem `@Public()` em nenhum método. Na prática, **o frontend público não consegue montar o mega menu nem a lista de categorias sem autenticação**. `GET /catalog/filters` (sem `categoryId`) até devolve as categorias-raiz como efeito colateral, mas não serve pra montar o mega menu completo (que precisa da árvore, não só do nível 1).

**Recomendo**: criar um `GET /categories` público (ou liberar o `GET` deste mesmo controller com `@Public()`), devolvendo a árvore ativa. Não fiz a mudança — é código, e você pediu só análise.

### 2.2 `GET /categories/{slug}` (banner + breadcrumb por categoria) não existe
O doc pede um endpoint por `slug` devolvendo `nome`, `texto_descricao`, `caminho_breadcrumb`. O que existe é `GET /catalog/banner?categoryId=<uuid>` (por **ID**, não slug) e ele **não devolve breadcrumb** — só `{title, description}`.

Pra bater com o doc, faltaria: (a) aceitar `categorySlug` além de `categoryId`, ou o frontend resolver o slug→id antes; (b) adicionar o campo de breadcrumb (ex.: montar `"Category / Sneakers"` ou `"Gender / Men"` subindo a árvore de `parent`).

### 2.3 `xpress_ship` (toggle) não está implementado
`QueryProductDto` tem `inStock` e `belowRetail`, mas não tem o terceiro toggle (`Xpress Ship`, ver PAGE-BROWSE-MEN.md seção 4). Isso não é só filtro que falta — não existe nenhum campo no schema (`ProductVariant`/`Product`) que represente "envio rápido". Precisa de decisão de produto antes (o que define isso pra vocês — hub próprio, transportadora específica, prazo?), não é só código.

### 2.4 `GET /brands/popular` e `GET /products/popular` (footer) não existem
O doc pede esses dois pro footer (colunas de marca/produtos populares, bom pra SEO). O que existe hoje é parecido mas não é a mesma coisa: `GET /products/best-sellers`, `/highlights`, `/new-arrivals`, `/best-prices` — nenhum agrupado por marca, e nenhum literalmente chamado "popular". Se o footer for prioridade, dá pra reaproveitar a lógica de `best-sellers` e só criar a rota/agrupamento por `Brand`.

---

## 3. Inconsistência interna que achei — `size_apparel` não segue a própria correção do conceito

Isso é uma contradição que eu mesmo introduzi numa sessão anterior, vale registrar:

- `BACKEND-ENDPOINT-CATALOG-FILTERS.md` + `PAGE-CATEGORY-ACCESSORIES.md` corrigem explicitamente a hipótese original: tamanho (Men's/Women's/Kid's Size) **não** é `visible_when: familia = X` fixo — é cálculo **dinâmico** (conta e some se zerar), porque "tamanho é algo que qualquer produto pode ou não ter cadastrado, independente da categoria".
- Mas o `size_apparel` que criei depois (pra roupa) ficou com `visibility: category_family, visibilityValue: vestuario` — ou seja, **fixo por família**, exatamente o modelo que a correção derrubou pros outros tamanhos.

Isso aconteceu porque `PAGE-CATEGORY-APPAREL.md` (que é o doc que sugeriu esse filtro de tamanho de roupa) foi escrito **antes** da correção de Accessories, e ele mesmo já avisa que é hipótese não confirmada por print real ("Preciso de um print... não vou inventar as opções desse filtro"). A correção posterior, por consistência, deveria valer pra `size_apparel` também.

**Se fosse pra corrigir** (não fiz, só análise): trocar `size_apparel` pra `visibility: always` — mesmo padrão de `size_men`/`size_women`/`size_kids`. Isso já teria efeito idêntico na prática hoje (todo produto de apparel que eu cadastrei via `STORAGES/` tem `size_apparel` vinculado, então "always" e "category_family=vestuario" dão o mesmo resultado com o dado atual) — mas fica errado assim que existir um produto de apparel sem tamanho cadastrado, ou uma categoria fora de "vestuario" que ganhe tamanho de roupa no futuro.

---

## 4. Decisão que já foi tomada e comunicada — não é gap, é registro

- **Nomes de campo em inglês/camelCase**, não os nomes em português dos exemplos do doc (`nome`→`name`, `preco_a_partir_de`→`priceFrom`, `patrocinado`→`featured`, `paginacao.pagina_atual`→`meta.page`, etc.) — decisão explícita tomada e comunicada a você na etapa de reconstrução de `GET /products`/`GET /catalog/filters`, sem objeção. Mantenho registrado aqui só pra não parecer gap não notado.
- **`Brand` como entidade própria** — `CONCEPT.md` linha 88 chega a questionar se marca própria "provavelmente não precisa" de um nível Brand tipo catálogo de terceiros. Isso foi superado por decisão sua posterior (você pediu o sistema de Brand completo + os dados de `STORAGES/` usam marcas de terceiros como dado de dev). Não é gap, é pivô explícito — só registro pra rastreabilidade.

---

## 5. Pontos menores / baixa prioridade

- **Ordem dos blocos na resposta de `GET /catalog/filters`**: o doc mostra uma ordem visual única (`CATEGORY → GENDER → BRANDS → SHOE HEIGHT → ACTIVITY → COLOR → PRICE → SIZES`). Nossa resposta separa em chaves (`category`, `categories`, `brands`, `facets[]`) — `brands` fica fora do array `facets`, então o frontend precisa saber "encaixar" Brands entre Gender e Shoe Height manualmente, a API não devolve isso como uma lista única já intercalada. Provavelmente não importa se o frontend já tem layout fixo, mas registro como observação.
- **Ordem dos valores de Gender**: um print (`PAGE-CATEGORY-ACCESSORIES.md`) mostrou ordem diferente (`Unisex, Men, Women, Kids`) de outro (`Men, Women, Kids, Unisex`), e o próprio doc especula que pode ser reordenação dinâmica por relevância — não confirmado. Hoje usamos `sortOrder` fixo (Men=1...Unisex=4). Como o doc-fonte já trata isso como incerto, não vejo necessidade de mudar sem mais evidência.

---

## 6. Resumo — prioridade se você quiser corrigir

1. **`GET /categories` público** (2.1) — bloqueia o menu principal de verdade, é o mais crítico.
2. **`size_apparel` visibility** (seção 3) — inconsistência que eu mesmo criei, fácil de corrigir (troca 1 linha no seed), sem quebrar nada com o dado atual.
3. **Breadcrumb em `GET /catalog/banner`** (2.2) — pequeno, mas está faltando um campo que o doc pede.
4. **`GET /brands/popular` / `/products/popular`** (2.4) — só relevante quando o footer for prioridade.
5. **`xpress_ship`** (2.3) — precisa de decisão de produto antes de virar código (o que define "envio rápido" pra vocês).

Nada disso foi alterado — é só o levantamento que você pediu.
