# Categorias

Rotas públicas de leitura da árvore de categorias. Para CRUD (criar/editar/apagar categorias), ver `14-admin-catalogo.md`.

---

## `GET /categories`

**Auth:** Público

Retorna a árvore completa de categorias **ativas**, já aninhada (raízes com `children` recursivo). Não tem paginação — é a árvore inteira de uma vez (hoje: 7 raízes + 53 subcategorias).

### Query params

Nenhum.

### Resposta `200`

```json
[
  {
    "id": "68f2dc1b-e613-4e31-b691-a0a669ba8c04",
    "name": "Accessories",
    "slug": "accessories",
    "code": "ACC",
    "familyTag": null,
    "bannerTitle": null,
    "bannerDescription": null,
    "parentId": null,
    "children": [
      {
        "id": "5613bfb3-2e62-494d-84d0-34a382195773",
        "name": "Bags",
        "slug": "bags",
        "code": "BAG",
        "familyTag": null,
        "bannerTitle": null,
        "bannerDescription": null,
        "parentId": "68f2dc1b-e613-4e31-b691-a0a669ba8c04",
        "children": []
      }
    ]
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Use para filtrar produtos (`categoryId` em `/products`, `/catalog/filters`, `/search`) |
| `name` | string | Nome de exibição |
| `slug` | string | Para URLs amigáveis (`/categoria/:slug` no frontend, se optarem por isso — a API não resolve por slug diretamente, só por `id`) |
| `code` | string \| null | Código interno (usado na geração de SKU, não relevante pro frontend) |
| `familyTag` | string \| null | Usado internamente pra regra de visibilidade de facetas (`category_family`) — não precisa ser exibido |
| `bannerTitle` / `bannerDescription` | string \| null | Texto de banner da página de categoria, se configurado. `null` = usar `name` como fallback |
| `parentId` | uuid \| null | `null` nas categorias raiz |
| `children` | array | Subcategorias diretas, mesma estrutura, recursivo |

---

## `GET /categories/:id`

**Auth:** Público

Retorna uma única categoria ativa (sem os filhos).

### Resposta `200`

```json
{
  "id": "5613bfb3-2e62-494d-84d0-34a382195773",
  "name": "Bags",
  "slug": "bags",
  "code": "BAG",
  "familyTag": null,
  "bannerTitle": null,
  "bannerDescription": null,
  "parentId": "68f2dc1b-e613-4e31-b691-a0a669ba8c04"
}
```

### Erros

| Status | Quando |
|---|---|
| `404` | `id` não existe ou categoria está inativa |
