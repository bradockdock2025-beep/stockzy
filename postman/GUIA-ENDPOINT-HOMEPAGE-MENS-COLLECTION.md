# Guia de integração — Seção "MEN'S COLLECTION" (homepage template BZ)

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
| `facets` | string | sim, pra esta seção | `gender:men\|unisex` — ver nota abaixo sobre por que inclui `unisex` |
| `limit` | number | não | Quantos produtos retornar (o print mostra 6) |
| `sort` | string | não | `featured\|price_asc\|price_desc\|newest\|relevance` — opcional, default é relevância/ordem de cadastro |

## Request exato desta seção

```
GET /products?facets=gender:men|unisex&limit=6
```

**Por que `gender:men|unisex` e não só `gender:men`:** o catálogo hoje não tem nenhum
produto marcado exclusivamente como "men" (é um catálogo de streetwear sem corte de gênero
na maior parte do sortimento) — o `|` no valor da faceta é OR, então essa query pega tanto
o que é explicitamente `men` quanto o que é `unisex` (a esmagadora maioria do catálogo).
Produto real disponível hoje: **263**. Se algum dia entrar produto realmente exclusivo de
homem, ele automaticamente aparece também, sem mudar a query.

## Estrutura da resposta

```json
{
  "data": [
    {
      "id": "b131f449-cd02-4d09-86b6-d0a64e0de8c5",
      "name": "Supreme Umbro Gradient Track Pant Navy",
      "slug": "supreme-umbro-gradient-track-pant-navy",
      "image": "https://.../product/....jpg",
      "brand": { "name": "Supreme", "logoUrl": null },
      "priceFrom": 20,
      "featured": false
    }
  ],
  "meta": {
    "total": 263,
    "page": 1,
    "limit": 6,
    "totalPages": 44
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
| `total` | number | total real (263 hoje) — não é `data.length` |
| `page` | number | página atual |
| `limit` | number | limite pedido |
| `totalPages` | number | `ceil(total / limit)` — útil se o "Men's Collection" tiver um "Ver mais"/paginação |

## Avisos importantes pro front

1. Como a query é bem ampla (`men|unisex`), a ordem dos 6 primeiros produtos vem da ordem
   default do banco (criação), não curada manualmente. Se quiser um "Men's Collection"
   curado (produtos específicos escolhidos à mão), usar `sort=featured` + marcar os
   produtos desejados como `featured=true` no admin, ou pedir pro back outro critério de
   ordenação.
2. Não confundir com a seção "Shop by Category" — aqui o filtro é por **gênero**, lá é por
   **tipo de peça** (`garment_type`). Os dois são independentes e combináveis (ex.:
   `facets=gender:women;garment_type:t-shirt` funciona se precisar).
