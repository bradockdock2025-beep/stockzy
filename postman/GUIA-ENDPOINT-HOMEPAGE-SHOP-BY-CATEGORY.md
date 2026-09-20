# Guia de integração — Seção "SHOP BY CATEGORY" (homepage template BZ)

> Guia de referência de endpoint pra essa seção específica da homepage. Não é código de
> front — é a estrutura de request/response que o back expõe, pra vocês integrarem.

## Endpoint base

```
GET /products
```

Público, sem autenticação. Cada um dos 8 tiles da seção ("T-Shirts", "Shirts", "Hoodies",
"Jackets", "Pants", "Shorts", "Dresses", "Tops") é a MESMA rota, com query diferente —
7 deles usam o parâmetro `facets` (faceta `garment_type`, ver tabela abaixo), 1 usa
`categoryId` porque "Dresses" é categoria própria, não tipo de peça.

## Query params usados nesta seção

| Param | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `facets` | string | não | Formato `"chave:valor1\|valor2"`. Pra esta seção: `garment_type:<valor>` |
| `categoryId` | string (uuid) | não | Filtra por categoria — usado só no tile "Dresses" |
| `limit` | number | não | Quantos produtos retornar (recomendado: quantos o tile for mostrar, ex. 6–8) |
| `page` | number | não | Paginação, default 1 |

## Mapeamento tile → request (confirmado contra o banco real hoje)

| Tile | Request | Produtos disponíveis hoje |
|---|---|---|
| T-Shirts | `GET /products?facets=garment_type:t-shirt&limit=8` | 22 |
| Shirts | `GET /products?facets=garment_type:shirt&limit=8` | 4 |
| Hoodies | `GET /products?facets=garment_type:hoodie&limit=8` | 5 |
| Jackets | `GET /products?facets=garment_type:jacket&limit=8` | 2 |
| Pants | `GET /products?facets=garment_type:pants\|sweatpants&limit=8` | 132 (13 pants + 119 sweatpants) |
| Shorts | `GET /products?facets=garment_type:shorts&limit=8` | 8 |
| Dresses | `GET /products?categoryId=11300504-f2c8-4a24-865d-29a3afc99d2e&limit=8` | 4 |
| Tops | `GET /products?categoryId=cef20acb-f27c-4b6f-8d4e-c23d5beb95d0&limit=8` | 36 (categoria inteira) |

**Correção sobre "Pants":** originalmente este guia recomendava só `garment_type:pants`
(13 produtos), separado de `sweatpants` (119). Isso é um erro de UX, não intencional —
sweatpants é fisicamente uma calça, e o print só tem UM tile "Pants" (não existe um tile
"Sweatpants" separado pra complementar). Filtrar só `pants` esconde 90% do estoque real de
calças do cliente que clicou exatamente onde deveria achá-las. Por isso a recomendação
agora é combinar os dois com `|` (OR) — 132 produtos reais, não 13. "Shorts" continua
separado porque é visual e funcionalmente diferente de calça, essa divisão faz sentido.

## Estrutura da resposta (igual pra todos os tiles)

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
    "total": 22,
    "page": 1,
    "limit": 2,
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
| `priceFrom` | number \| null | menor preço entre as variantes disponíveis; `null` só se não houver variante nenhuma |
| `featured` | boolean | não é usado por essa seção, ignorar |

### Campos de `meta`

| Campo | Tipo | Notas |
|---|---|---|
| `total` | number | total de produtos que batem o filtro (não é `data.length`) |
| `page` | number | página atual |
| `limit` | number | limite pedido |
| `totalPages` | number | `ceil(total / limit)` |

## Avisos importantes pro front

1. **"Dresses" e "Shirts" são produtos de preenchimento (placeholder de dev)**, clonados de
   outras peças do catálogo — as fotos não são de vestido/camisa de verdade (ex.: os 4
   "Dresses" usam foto de t-shirt/jaqueta/sweatpants). Se o design for pra produção real,
   sinalizar que essas duas categorias precisam de produto/foto real cadastrado depois.
2. Se um tile retornar `meta.total` menor que o `limit` pedido, `data.length` já reflete
   isso — não preencher espaço vazio, é o catálogo real (ex. "Jackets" só tem 2 produtos).
3. Erro 400 se `categoryId` não for um UUID válido, ou se `garment_type` tiver um valor que
   não existe na faceta — nesse caso a resposta vem com `data: []`, não erro.
