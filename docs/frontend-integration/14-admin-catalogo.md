# Admin — Catálogo (Categorias, Marcas, Facetas, Produtos)

**Auth:** JWT admin (`Authorization: Bearer <accessToken>`, ver `13-admin-autenticacao.md`). Roles permitidos indicados por seção — `admin` sempre pode; `manager` só onde indicado.

---

## Categorias — `/admin/categories` (roles: `admin`, `manager`)

| Método | Rota | Body | Descrição |
|---|---|---|---|
| `POST` | `/admin/categories` | `CreateCategoryDto` | Cria categoria |
| `GET` | `/admin/categories` | — | Lista **todas** (inclusive inativas — diferente do `GET /categories` público) |
| `GET` | `/admin/categories/:id` | — | Detalhe |
| `PATCH` | `/admin/categories/:id` | `CreateCategoryDto` parcial | Atualiza |
| `PATCH` | `/admin/categories/:id/deactivate` | — | Soft-delete (`isActive: false`) |
| `DELETE` | `/admin/categories/:id` | — | Hard delete — falha se houver produtos vinculados |
| `POST` | `/admin/categories/:id/merge` | `{ "targetCategoryId": "uuid" }` | Move todos os produtos de `:id` pra `targetCategoryId` e desativa `:id` |

### `CreateCategoryDto`

```json
{ "name": "Sneakers", "slug": "sneakers", "code": "SNK", "parentId": null, "familyTag": null, "bannerTitle": null, "bannerDescription": null }
```
Só `name`/`slug` obrigatórios. Ver `01-categorias.md` pro significado de cada campo.

---

## Marcas — `/admin/brands` (roles: `admin`, `manager`)

| Método | Rota | Body |
|---|---|---|
| `POST` | `/admin/brands` | `{ "name": "Nike", "slug": "nike", "logoUrl": null, "isActive": true }` |
| `GET` | `/admin/brands` | — |
| `GET` | `/admin/brands/:id` | — |
| `PATCH` | `/admin/brands/:id` | Parcial |
| `PATCH` | `/admin/brands/:id/deactivate` | — |
| `DELETE` | `/admin/brands/:id` | — |

---

## Facetas — `/admin/facets` (roles: `admin`, `manager`)

| Método | Rota | Body |
|---|---|---|
| `POST` | `/admin/facets` | `CreateFacetDto` |
| `GET` | `/admin/facets` | — |
| `GET` | `/admin/facets/:id` | — |
| `PATCH` | `/admin/facets/:id` | Parcial |
| `DELETE` | `/admin/facets/:id` | — |
| `POST` | `/admin/facets/:facetId/values` | `CreateFacetValueDto` |
| `PATCH` | `/admin/facets/:facetId/values/:id` | Parcial |
| `DELETE` | `/admin/facets/:facetId/values/:id` | — |

### `CreateFacetDto`

```json
{
  "key": "color",
  "name": "Cor",
  "inputType": "swatch",
  "scope": "variant",
  "visibility": "always",
  "visibilityValue": null,
  "sortOrder": 1,
  "isActive": true
}
```

| Campo | Valores válidos |
|---|---|
| `key` | `snake_case` minúsculo, estável — usado nas queries (`facets=key:val`). **Não pode ser alterado depois sem quebrar URLs/filtros já salvos em algum lugar** |
| `inputType` | `link` \| `checkbox` \| `swatch` \| `slider` \| `chip` — dica de UI pro frontend renderizar o filtro |
| `scope` | `product` (atributo do produto inteiro) \| `variant` (atributo por variante, ex.: tamanho/cor) |
| `visibility` | `always` \| `category_family` (só aparece se a categoria ativa tiver esse `familyTag`) \| `gender_fixed_absent` \| `gender_equals` (só aparece se o filtro `gender` ativo bater com `visibilityValue`) |
| `visibilityValue` | Obrigatório quando `visibility` é `category_family` ou `gender_equals` |

### `CreateFacetValueDto`

```json
{ "value": "black", "label": "Black", "extra": { "hex": "#000000" }, "sortOrder": 1, "isActive": true, "bannerTitle": null, "bannerDescription": null }
```

`extra` é um JSON livre — usado por exemplo pra guardar o hex de uma cor (`{"hex": "#000000"}`) pro frontend renderizar o swatch sem precisar de tabela de cores à parte.

---

## Produtos — `/admin/products` (role: **só `admin`**, `manager` não tem acesso)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/products` | Lista — mesmos filtros de `QueryProductDto` (ver `02-produtos.md`), mas devolve o produto **completo**, não o card enxuto |
| `GET` | `/admin/products/:id` | Detalhe completo |
| `POST` | `/admin/products` | Cria produto + variantes |
| `POST` | `/admin/products/:id/images` | Upload de imagens (`multipart/form-data`, campo `files`, até 10, 15MB cada, só `image/*`). Query opcional `variantId` pra associar a imagem a uma variante específica em vez do produto |
| `PATCH` | `/admin/products/reorder` | Reordena vitrine — `{ "products": [{"id": "uuid", "position": 1}, ...] }` |
| `PATCH` | `/admin/products/:id` | Atualiza (parcial) |
| `PATCH` | `/admin/products/:id/archive` | Mesma coisa que `DELETE` — arquiva (soft) |
| `PATCH` | `/admin/products/variants/:id/presale` | Configura presale de uma variante |
| `GET` | `/admin/products/:id/price-history` | Histórico de mudanças de preço da variante |
| `DELETE` | `/admin/products/:id` | Arquiva (não é hard delete, apesar do verbo) |

### `CreateProductDto`

```json
{
  "categoryId": "uuid",
  "brandId": "uuid",
  "name": "Air Max 270",
  "slug": "nike-air-max-270",
  "description": "...",
  "status": "active",
  "featured": false,
  "facetValueIds": ["uuid-do-valor-gender-men"],
  "variants": [
    {
      "sku": "opcional, gerado automaticamente se omitido",
      "title": null,
      "price": 129.99,
      "compareAtPrice": null,
      "stockQuantity": 20,
      "facetValueIds": ["uuid-do-valor-color-black", "uuid-do-valor-size-42"]
    }
  ]
}
```

`facetValueIds` no nível do produto = facetas com `scope: product` (ex.: gênero, atividade). `facetValueIds` dentro de cada variante = facetas com `scope: variant` (ex.: cor, tamanho). **SKU é gerado automaticamente** se não informado (formato `DEPARTAMENTO-CATEGORIA-ANO-SEQUENCIAL`, baseado em `category.code`).

`UpdateProductDto` é o mesmo shape, todos os campos opcionais (`PartialType`), e cada item de `variants[]` pode incluir `id` (edita variante existente) ou omitir `id` (cria uma nova variante nessa mesma chamada).

### `PATCH /admin/products/variants/:id/presale`

```json
{ "presaleEnabled": true, "presalePrice": 119.99, "presaleLimit": 50, "expectedAvailableAt": "2026-09-01" }
```
