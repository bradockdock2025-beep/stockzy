# Catálogo — Filtros Facetados e Busca

## O sistema de facetas — conceito

Além de `Brand` (marca, entidade própria) e `Category`, todo outro atributo de produto/variante (cor, tamanho, gênero, atividade, cano do calçado, etc.) é modelado como uma **Facet** genérica:

- `Facet` — define o atributo (`key` estável tipo `color`, `size_men`, `gender`; `name` de exibição; `inputType`: `link`/`checkbox`/`swatch`/`slider`/`chip` — dica visual de como renderizar; `scope`: `product` ou `variant`, define se o valor é do produto inteiro ou de cada variante)
- `FacetValue` — os valores possíveis daquela faceta (ex.: faceta `color` tem valores `black`, `white`, `red`...)

### Como filtrar por faceta na query string

Parâmetro `facets`, formato: `key:val1|val2;key2:val3`

```
GET /products?facets=color:black|white;size_men:42
```
→ produtos com cor preta OU branca, E tamanho 42 (homem).

Isso é usado em `GET /products`, `GET /products/:id`, `GET /catalog/filters` e `GET /search` — **mesmo formato em todo lugar**.

Marca é **separada**, parâmetro próprio: `brand=nike` (ou `brand=nike&brand=adidas` para várias).

---

## `GET /catalog/filters` — Painel de filtros com contagem (auto-exclusão)

**Auth:** Público

Retorna, para a categoria/filtros ativos, quais opções de filtro mostrar e quantos produtos cada uma resultaria — a base pra montar a sidebar de filtros de uma PLP (página de listagem).

**Regra de auto-exclusão:** a contagem de cada faceta é calculada aplicando **todos os outros filtros ativos, exceto o dela mesma**. Ex.: se você já filtrou `color:black`, a contagem de "Cor" ainda mostra as outras cores com suas contagens (calculadas sem considerar o próprio filtro de cor) — assim o usuário pode trocar de cor sem "zerar" a lista.

**Facetas que zeram somem da resposta.** Se depois da auto-exclusão uma faceta inteira teria contagem 0 em todos os valores, ela não aparece no array `facets` — não mostre uma seção vazia no frontend, porque ela literalmente não vem.

### Query params

Mesmos de `GET /products` (`categoryId`, `minPrice`, `maxPrice`, `brand`, `facets`, `inStock`, `belowRetail`, `search`, `featured`) — passe os **mesmos filtros que o usuário já aplicou** na listagem, pra sidebar recalcular certo.

### Resposta `200`

```json
{
  "category": { "id": "...", "name": "Sneakers", "slug": "sneakers" },
  "categories": [
    { "id": "...", "name": "Running", "slug": "running", "code": "RUN", "count": 12 }
  ],
  "brands": [
    { "value": "nike", "label": "Nike", "count": 8 },
    { "value": "adidas", "label": "adidas", "count": 2 }
  ],
  "facets": [
    {
      "key": "color",
      "name": "Cor",
      "inputType": "swatch",
      "values": [
        { "value": "black", "label": "Black", "count": 5 },
        { "value": "white", "label": "White", "count": 3 }
      ]
    }
  ],
  "priceMin": 49.99,
  "priceMax": 299.99
}
```

| Campo | Descrição |
|---|---|
| `category` | Categoria ativa (a que veio em `categoryId`), ou `null` se nenhuma foi passada |
| `categories` | **Filhos diretos** da categoria ativa (ou categorias raiz, se nenhuma `categoryId`) — não é a árvore inteira, só um nível, com contagem de produtos |
| `brands` | Sempre com auto-exclusão, mesmo mecanismo que as facetas. Só marcas com `count > 0` aparecem |
| `facets` | Array dinâmico — quantidade e quais facetas aparecem dependem do contexto (categoria, filtros já aplicados). `inputType` é a dica de como renderizar (`swatch` = amostra de cor, `chip` = botão, `checkbox`, `slider`, `link`) |
| `priceMin` / `priceMax` | Calculado sobre **todos** os filtros aplicados (sem exceção — diferente das demais seções) |

---

## `GET /catalog/banner`

**Auth:** Público

Banner de topo de página de categoria ou de gênero. Aceita `categoryId` **ou** `facets` (com uma faceta `gender`), não os dois.

### Resposta `200`

```json
{ "title": "Sneakers", "description": null }
```

`title`/`description` vêm de `bannerTitle`/`bannerDescription` da categoria ou do valor de faceta `gender`, com fallback pro nome/label se não configurado. `{title: null, description: null}` se nada bater.

---

## `GET /catalog/release-calendar`

**Auth:** Público

Próximos lançamentos (produtos com variantes em presale), ordenados por data de disponibilidade mais próxima.

### Query params (`QuerySectionDto`)

`limit` (padrão 12), `categoryId`.

### Resposta `200`

```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "image": "https://...",
      "brand": { "name": "Nike", "logoUrl": null },
      "price": 129.99,
      "expectedAvailableAt": "2026-09-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "visible": true, "section": "release-calendar" }
}
```

---

## `GET /search` — Busca livre com sidebar facetada

**Auth:** Público

Diferente de `GET /products?search=`, este endpoint devolve **junto** uma sidebar de filtros já calculada pro resultado da busca (categorias, marcas, facetas, faixa de preço, contadores de estoque/desconto) — é o endpoint certo pra uma página de resultados de busca completa.

### Query params (`SearchQueryDto`)

| Param | Tipo | Descrição |
|---|---|---|
| `q` | string | Termo de busca (nome/descrição) |
| `page` | int ≥1 | Padrão `1` |
| `limit` | int 1–48 | Padrão `24` |
| `sort` | `relevance` \| `newest` \| `price_asc` \| `price_desc` \| `discount` | Padrão `relevance` |
| `categoryId` | uuid | — |
| `minPrice` / `maxPrice` | number | — |
| `inStock` | `"true"` \| `"false"` | — |
| `hasDiscount` | `"true"` \| `"false"` | Só produtos com `compareAtPrice` setado |
| `brand` | string ou string[] | `Brand.slug` |
| `facets` | string | Mesmo formato `key:val1\|val2` |

### Resposta `200`

```json
{
  "data": [ /* produtos completos, com variants/images/category — mesmo shape do GET /products/:id */ ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 24,
    "totalPages": 2,
    "query": "nike",
    "appliedFilters": {
      "categoryId": null, "minPrice": null, "maxPrice": null,
      "inStock": false, "hasDiscount": false,
      "brand": ["nike"], "facets": [{ "key": "color", "values": ["black"] }],
      "sort": "relevance"
    }
  },
  "sidebar": {
    "categories": [{ "id": "...", "name": "Sneakers", "slug": "sneakers", "count": 12 }],
    "brands": [{ "value": "nike", "label": "Nike", "count": 8 }],
    "facets": [{ "key": "color", "name": "Cor", "inputType": "swatch", "values": [{ "value": "black", "label": "Black", "count": 5 }] }],
    "priceRange": { "min": 49.99, "max": 299.99 },
    "inStock": { "count": 30 },
    "discount": { "count": 5 }
  }
}
```

A `sidebar` usa o mesmo princípio de auto-exclusão de `GET /catalog/filters`. `sidebar.categories` aqui **não** é limitado a um nível — mostra qualquer categoria com resultado, útil pra busca livre atravessar a árvore inteira.

---

## `GET /search/suggestions` — Autocomplete

**Auth:** Público

Endpoint leve pra dropdown de sugestões enquanto o usuário digita (não é a busca completa).

### Query params (`SuggestionsQueryDto`)

| Param | Tipo | Obrigatório |
|---|---|---|
| `q` | string | **Sim** |
| `limit` | int 1–10 | Não, padrão 6 |

Se `q.length < 2`, retorna `{"data": []}` direto (sem consultar o banco) — o frontend pode aplicar essa mesma regra localmente pra evitar chamadas desnecessárias.

### Resposta `200`

```json
{
  "data": [
    {
      "id": "...",
      "name": "Air Max 270",
      "slug": "nike-air-max-270",
      "image": { "url": "https://...", "alt": null },
      "price": 99.99,
      "compareAtPrice": null
    }
  ]
}
```
