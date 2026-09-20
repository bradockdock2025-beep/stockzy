# Guia de integração — Seção "ACCESSORIES" (homepage template BZ)

> Guia de referência de endpoint pra essa seção específica da homepage. Não é código de
> front — é a estrutura de request/response que o back expõe, pra vocês integrarem.

## Endpoint

```
GET /products
```

Público, sem autenticação.

## Query params usados nesta seção

| Param | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `categoryId` | string (uuid) | sim, pra esta seção | id da categoria raiz "Accessories" |
| `limit` | number | não | Quantos produtos retornar (o print mostra 6) |
| `sort` | string | não | `featured\|price_asc\|price_desc\|newest\|relevance` |

## Request exato desta seção

```
GET /products?categoryId=68cfdb28-6bfe-4ad2-b40c-1af339525322&limit=6
```

`68cfdb28-6bfe-4ad2-b40c-1af339525322` é o id fixo da categoria raiz "Accessories" — pode
confirmar/revalidar a qualquer momento chamando `GET /categories` (não precisa hardcodar
sem checar, mas esse id não muda sozinho). Diferente das outras seções, aqui **não** precisa
de `facets` — Accessories já é categoria específica o suficiente (Belts, Watches, Wallets &
Card Holders, Eyewear, Jewelry, Bags, etc. são todas subcategorias dela, e o filtro por
`categoryId` da categoria raiz já inclui os produtos de todas as subcategorias).

Produto real disponível hoje: **62**.

## Estrutura da resposta

```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "slug": "...",
      "image": "https://.../product/....jpg",
      "brand": { "name": "...", "logoUrl": null },
      "priceFrom": 45,
      "featured": false
    }
  ],
  "meta": {
    "total": 62,
    "page": 1,
    "limit": 6,
    "totalPages": 11
  }
}
```

### Campos de cada item em `data[]`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (uuid) | usar pra montar o link do produto / detectar clique no card |
| `name` | string | nome completo do produto |
| `slug` | string | usar na URL da PLP/PDP (`/produtos/<slug>`), não o `id` |
| `image` | string \| null | URL pública (Supabase Storage), já pronta pra `<img src>` |
| `brand` | `{ name, logoUrl }` \| null | `logoUrl` pode ser `null` mesmo com `brand` presente |
| `priceFrom` | number \| null | menor preço entre as variantes disponíveis |
| `featured` | boolean | pode usar pra destacar algum card, opcional |

### Campos de `meta`

| Campo | Tipo | Notas |
|---|---|---|
| `total` | number | total real (62 hoje) — não é `data.length` |
| `page` | number | página atual |
| `limit` | number | limite pedido |
| `totalPages` | number | `ceil(total / limit)` |

## Avisos importantes pro front

1. Diferente de "Shop by Category" (que tem tiles separados por tipo — Belts, Watches,
   etc.), essa seção da homepage é um grid único misturando todas as subcategorias de
   Accessories. Se o design pedir tiles separados por tipo de acessório no futuro, aí sim
   usar `categoryId` da subcategoria específica (ex. Belts, Watches — pegar o id real via
   `GET /categories`, não tem faceta `garment_type` do lado de Accessories, o filtro é
   direto por categoria).
2. Mesmo endpoint reaproveitado do menu "ACCESSORIES" do header, se o front quiser manter
   consistência entre a seção da home e a página de listagem completa.
