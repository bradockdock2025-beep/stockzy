# Guia de integração — Seção "TOPS & SWEATSHIRTS" (homepage template BZ)

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
| `facets` | string | sim, pra esta seção | `garment_type:t-shirt\|jersey\|hoodie\|sweater\|shirt` (OR entre os 5 valores) |
| `limit` | number | não | Quantos produtos retornar (o print mostra 6) |
| `sort` | string | não | `featured\|price_asc\|price_desc\|newest\|relevance` |

## Request exato desta seção

```
GET /products?facets=garment_type:t-shirt|jersey|hoodie|sweater|shirt&limit=6
```

### Por que essa combinação e não `categoryId=Tops`

O print mostra hoodie, sweatshirt, t-shirt e polo juntos no mesmo grid — mas no catálogo
real, **hoodie mora na categoria `Outerwear`**, não em `Tops` (categoria = prateleira física
do produto; hoodie é uma peça de frio, mesma prateleira de jaqueta). Se filtrar só por
`categoryId=<Tops>`, os hoodies ficam de fora. Por isso esta seção usa `garment_type` (o
"tipo de peça", que atravessa categoria) em vez de `categoryId` — pega t-shirt/jersey/shirt
de Tops **e** hoodie de Outerwear na mesma query, sem depender de onde o produto mora.

`sweater` está na lista mas hoje tem 0 produto real (`polo` e `tank-top` idem) — não atrapalha
a query, só não contribui produto por enquanto.

Produto real disponível hoje: **36** (22 t-shirt + 5 jersey + 5 hoodie + 4 shirt + 0 sweater,
sem sobreposição entre eles).

## Estrutura da resposta

```json
{
  "data": [
    {
      "id": "9b305ec7-57e5-436b-8435-c4ddb90d1ddc",
      "name": "Anthem Pullover Hoodie Black",
      "slug": "anthem-pullover-hoodie-black",
      "image": "https://.../product/....jpg",
      "brand": { "name": "Vertabrae", "logoUrl": null },
      "priceFrom": 20,
      "featured": false
    }
  ],
  "meta": {
    "total": 36,
    "page": 1,
    "limit": 6,
    "totalPages": 6
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
| `total` | number | total real (36 hoje) — não é `data.length` |
| `page` | number | página atual |
| `limit` | number | limite pedido |
| `totalPages` | number | `ceil(total / limit)` |

## Avisos importantes pro front

1. Essa query mistura categorias por trás dos panos (Tops + Outerwear) — não estranhar se
   um produto retornado tiver, em outro contexto (ex. PDP), `categoryId` apontando pra
   "Outerwear" em vez de "Tops". É esperado, é assim que o hoodie entra na seção.
2. "Shirts" (4 produtos) inclusos aqui são os mesmos clones de preenchimento citados no guia
   de "Shop by Category" — mesma ressalva de foto reaproveitada.
3. Se quiser excluir `shirt`/`jersey` e deixar só "camiseta + moletom" de verdade, é só
   tirar esses valores do `facets` — a lista de valores é livre, não fixa.
