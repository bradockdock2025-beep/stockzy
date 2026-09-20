# Guia de integração — Seção "WOMEN'S COLLECTION" (homepage template BZ)

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
| `facets` | string | sim, pra esta seção | `gender:women` |
| `limit` | number | não | Quantos produtos retornar (o print mostra 6) |
| `sort` | string | não | `featured\|price_asc\|price_desc\|newest\|relevance` |

## Request exato desta seção

```
GET /products?facets=gender:women&limit=6
```

Diferente de "Men's Collection", aqui **não** precisa de OR com `unisex` — existe sinal
real de produto exclusivamente feminino no catálogo (nome com "Women's" explícito).
Produto real disponível hoje: **14**.

## Estrutura da resposta

```json
{
  "data": [
    {
      "id": "8e953340-3da5-492c-891f-2a4159e74dfe",
      "name": "Women's Madonna Sleeveless T-Shirt Black",
      "slug": "bottega-desires-women-s-madonna-sleeveless-t-shirt-black",
      "image": "https://.../product/8c4be7db-d4f7-482e-969e-8ae7ea8ae744.jpg",
      "brand": {
        "name": "Bottega Desires",
        "logoUrl": "https://.../brands/f36d3c0e-1c32-4f38-8f13-03b496a0fdc1.png"
      },
      "priceFrom": 20,
      "featured": false
    }
  ],
  "meta": {
    "total": 14,
    "page": 1,
    "limit": 6,
    "totalPages": 3
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
| `total` | number | total real (14 hoje) — não é `data.length` |
| `page` | number | página atual |
| `limit` | number | limite pedido |
| `totalPages` | number | `ceil(total / limit)` |

## Avisos importantes pro front

1. **14 produtos é pouco pra um catálogo de verdade** — inclui 5 sneakers femininos, 5
   sneakers infantis não entram aqui (são `gender:kids`, seção separada se o design tiver
   uma), e 4 peças de Apparel que são clones de preenchimento (mesma ressalva do guia de
   "Shop by Category" — fotos reaproveitadas de outro produto, não é foto real de peça
   feminina nova). Se o grid da home pedir 6 itens e o catálogo só tiver 14 no total, o
   "Ver mais" da seção vai esgotar rápido — considerar isso na paginação/UX.
2. Não confundir com "Shop by Category": aqui o filtro é por **gênero**, lá é por **tipo de
   peça** (`garment_type`). São combináveis se precisar (ex. mostrar só vestidos femininos:
   `facets=gender:women;categoryId=<Dresses>` — nesse caso usar `categoryId` junto de
   `facets`, já que Dresses é categoria, não `garment_type`).
