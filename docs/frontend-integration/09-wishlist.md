# Wishlist (Lista de Desejos)

**Auth:** Todos os endpoints exigem `Authorization: Bearer <accessToken>` de cliente. Não existe wishlist para guest.

---

## `GET /customers/wishlist`

### Resposta `200`

```json
{
  "id": "uuid-da-wishlist",
  "customerId": "...",
  "total": 2,
  "items": [
    {
      "id": "uuid-do-item",
      "addedAt": "2026-07-30T...",
      "product": {
        "id": "...",
        "name": "Air Max 270",
        "slug": "nike-air-max-270",
        "status": "active",
        "image": { "url": "https://...", "altText": null },
        "price": 99.99,
        "compareAtPrice": 129.99,
        "discountPercent": 23,
        "inStock": true,
        "category": { "id": "...", "name": "Sneakers", "slug": "sneakers" }
      }
    }
  ]
}
```

Se o cliente ainda não tem wishlist criada: `{ "id": null, "customerId": "...", "items": [], "total": 0 }` (não é erro).

`product.price`/`compareAtPrice` refletem a **primeira variante ativa** do produto (ordenada por menor preço) — não necessariamente a que o usuário "queria" especificamente, já que wishlist é por produto, não por variante.

---

## `POST /customers/wishlist/items`

### Body

```json
{ "productId": "uuid-do-produto" }
```

### Resposta `201`

A wishlist inteira atualizada (mesmo shape de `GET /customers/wishlist`).

### Erros

| Status | Quando |
|---|---|
| `404` | Produto não existe |
| `409` | Produto já está na wishlist |

---

## `DELETE /customers/wishlist/items/:productId`

Remove o item. Resposta `200` com a wishlist atualizada.

### Erros

| Status | Quando |
|---|---|
| `404` | Wishlist ou item não encontrado |

---

## `POST /customers/wishlist/items/:productId/move-to-cart`

Move o item da wishlist pro carrinho — usa a **primeira variante ativa** do produto (menor preço), quantidade `1`. Remove da wishlist ao mover.

**Headers:** `x-cart-token` (opcional — se não enviar, cria um carrinho novo, mesma regra de `04-carrinho.md`).

### Resposta `201`

```json
{
  "cart": { "token": "...", "items": [...], "subtotal": 99.99, "updatedAt": "..." },
  "cartToken": "..."
}
```

Guarde `cartToken` do jeito de sempre (ver `04-carrinho.md`) — não confunda com o `cart.token` interno, são o mesmo valor, mas use o de fora (`cartToken`) por clareza.

### Erros

| Status | Quando |
|---|---|
| `404` | Item não está na wishlist, ou produto não tem nenhuma variante ativa |
