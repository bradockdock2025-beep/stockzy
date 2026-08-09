# Produtos

**Importante — duas formas de produto diferentes nesta API:**

1. **Card enxuto** (`id`, `name`, `image`, `brand`, `priceFrom`, `featured`) — usado só em `GET /products` (grid principal).
2. **Produto completo** (todos os campos + `variants[]` com estoque/disponibilidade + `images[]` + `category`) — usado em `GET /products/:id`, `GET /products/slug/:slug`, e em **todas** as vitrines (`offers`, `highlights`, `new-arrivals`, `best-sellers`, `best-prices`).

Não assuma que todo endpoint de listagem devolve o mesmo formato de item — eles são diferentes de propósito (grid principal é otimizado pra ser leve; vitrines/detalhe precisam do preço real por variante e status de estoque).

---

## `GET /products` — Grid principal

**Auth:** Público

### Query params (`QueryProductDto`)

| Param | Tipo | Descrição |
|---|---|---|
| `page` | int ≥1 | Padrão `1` |
| `limit` | int ≥1 | Padrão `10` |
| `search` | string | Busca por nome/slug (busca simples — para busca completa com facetas de sidebar, use `GET /search`, ver `03-catalogo-filtros-busca.md`) |
| `categoryId` | uuid | Filtra por categoria (inclui subcategorias automaticamente) |
| `minPrice` / `maxPrice` | number | Faixa de preço |
| `sort` | `featured` \| `price_asc` \| `price_desc` \| `newest` \| `relevance` | Padrão `featured` |
| `inStock` | `"true"` \| `"false"` (string, não boolean) | Só produtos com estoque disponível |
| `belowRetail` | `"true"` \| `"false"` | Só variantes com `price < compareAtPrice` |
| `featured` | `"true"` \| `"false"` | Filtra por produto em destaque |
| `brand` | string ou string[] | `Brand.slug` — um ou vários, ex.: `brand=nike&brand=adidas` |
| `facets` | string | Formato `key:val1\|val2;key2:val3` — ver explicação completa em `03-catalogo-filtros-busca.md`. Ex.: `facets=color:black\|white;size_men:42` |

### Resposta `200`

```json
{
  "data": [
    {
      "id": "06a80171-3800-4811-b909-6a6669f7ce07",
      "name": "Air Griffey Max 1 Hall of Fame",
      "image": "https://.../Nike-Air-Griffey-Max-1-Hall-of-Fame-Product.jpg",
      "brand": { "name": "Nike", "logoUrl": null },
      "priceFrom": 99.99,
      "featured": false
    }
  ],
  "meta": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 }
}
```

| Campo do item | Descrição |
|---|---|
| `image` | Primeira imagem do produto (ordenada por `position`), ou `null` se não tiver |
| `brand` | `null` se o produto não tem marca vinculada |
| `priceFrom` | Menor preço entre as variantes **disponíveis** (com estoque); se nenhuma tiver estoque, cai pro menor preço geral. `null` se não houver variantes |
| `featured` | Booleano — produto marcado como destaque pelo admin |

---

## `GET /products/:id` — Detalhe completo

**Auth:** Público

Mesma query string de `/products` é aceita (`facets`, `brand`, etc.) — filtra **quais variantes** vêm na resposta, não o produto em si (o produto sempre vem se existir e estiver ativo).

### Resposta `200` — objeto completo

```json
{
  "id": "06a80171-3800-4811-b909-6a6669f7ce07",
  "categoryId": "d4844604-f971-43cc-a997-b37fa5d8ad9a",
  "brandId": "...",
  "name": "Air Griffey Max 1 Hall of Fame",
  "slug": "nike-air-griffey-max-1-hall-of-fame",
  "description": "...",
  "status": "active",
  "featured": false,
  "featuredUntil": null,
  "featuredOrder": null,
  "displayOrder": null,
  "createdAt": "2026-07-20T10:00:00.000Z",
  "updatedAt": "2026-07-20T10:00:00.000Z",
  "category": { "id": "...", "name": "Sneakers", "slug": "sneakers", "...": "..." },
  "brand": { "id": "...", "name": "Nike", "slug": "nike", "logoUrl": null, "isActive": true },
  "images": [
    { "id": "...", "productId": "...", "variantId": null, "url": "https://...", "altText": null, "position": 0 }
  ],
  "facetValues": [
    { "facetValue": { "value": "men", "label": "Men", "facet": { "key": "gender", "name": "Gênero" } } }
  ],
  "variants": [
    {
      "id": "dca9b8a1-...",
      "productId": "...",
      "sku": "DEV-0BC4044D-39",
      "title": null,
      "price": "99.99",
      "compareAtPrice": null,
      "weightKg": null,
      "isActive": true,
      "presaleEnabled": false,
      "presalePrice": null,
      "presaleLimit": null,
      "expectedAvailableAt": null,
      "inventory": { "stockQuantity": 10, "reservedQuantity": 1 },
      "facetValues": [
        { "facetValue": { "value": "42", "label": "42", "facet": { "key": "size_men", "name": "Tamanho (Homem)" } } }
      ],
      "availableQuantity": 9,
      "isAvailable": true,
      "purchaseMode": "normal"
    }
  ]
}
```

### Campos calculados por variante (não vêm do banco direto, são adicionados na resposta)

| Campo | Descrição |
|---|---|
| `availableQuantity` | `stockQuantity - reservedQuantity`, nunca negativo |
| `isAvailable` | `availableQuantity > 0` |
| `purchaseMode` | `"normal"` \| `"sold_out"` \| `"presale"` \| `"presale_sold_out"` — **use este campo pra decidir o que mostrar no botão de compra**, não calcule você mesmo a partir de `isAvailable` sozinho, porque presale tem regra própria (não depende de `stockQuantity`) |
| `presaleRemaining` | Só presente quando `presaleEnabled: true` — unidades restantes do limite de presale, ou `null` se não há limite |

`price` e `compareAtPrice` vêm como **string** (formato `Decimal` do Prisma serializado), não number — faça `Number(variant.price)` no frontend.

`facetValues` (tanto do produto quanto de cada variante) é a lista de atributos — cor, tamanho, gênero, atividade, etc., dependendo de quais facetas o produto/variante tem vinculadas. Ver `03-catalogo-filtros-busca.md` pra entender o sistema de facetas.

### Erros

| Status | Quando |
|---|---|
| `404` | `id` não existe ou produto não está `active` |
| `400` | `id` não é um UUID válido |

---

## `GET /products/slug/:slug`

**Auth:** Público

Idêntico a `GET /products/:id` em tudo (mesma query string, mesma resposta), só que busca por `slug` em vez de `id`. Use esse endpoint pras URLs de PDP (`/produto/:slug`) no frontend.

---

## Vitrines (todas retornam o **produto completo**, igual ao detalhe, não o card enxuto)

Todas aceitam `QuerySectionDto`:

| Param | Tipo | Descrição |
|---|---|---|
| `limit` | int 1–48 | Quantidade de itens |
| `categoryId` | uuid | Filtra por categoria |
| `days` | int 1–365 | Só em `new-arrivals` |
| `window` | `7d` \| `30d` \| `all` | Só em `best-sellers` |
| `minDiscount` | int 1–99 | Só em `best-prices` |

Resposta padrão: `{ "data": [ <produto completo>, ... ], "meta": { "total": N, "visible": true, "section": "..." } }`.

`meta.visible` é `false` quando `data.length < 4` — **o frontend deve esconder a seção inteira quando `visible: false`** (é a regra de negócio: uma vitrine com poucos itens não é mostrada).

### `GET /products/highlights`

Produtos marcados `featured: true` com `featuredUntil` ainda no futuro, ordenados por `featuredOrder`. Se não houver suficientes, completa com os mais recentes.

### `GET /products/new-arrivals`

Produtos criados nos últimos `days` dias (padrão 30).

### `GET /products/best-sellers`

Baseado em `ProductRanking` (unidades vendidas na janela `window`). Se não houver ranking calculado ainda, cai pro fallback de mais recentes (`meta.fallback: true` sinaliza isso).

### `GET /products/best-prices`

Produtos com desconto ≥ `minDiscount`% (`compareAtPrice` vs `price`).

### `GET /products/offers`

**Query params (`QueryOffersDto`):** `type` (`daily` \| `all`, padrão mostra todas), `page`, `limit`.

Baseado em `Promotion` ativas vinculadas a produto/categoria — **não** é a mesma coisa que desconto de preço (`best-prices`); são promoções cadastradas pelo admin. Resposta com paginação padrão (`meta: {total, page, limit, totalPages}`), sem o `visible`/`section` das outras vitrines.
