# Carrinho

**Auth:** Público — funciona tanto para visitante quanto para cliente logado. O carrinho vive no **Redis** (não no banco relacional), identificado por um token opaco.

## Como o token de carrinho funciona — leia isto antes de integrar

1. Na **primeira** chamada (`GET /cart` ou `POST /cart/items`), **não envie** o header `x-cart-token`.
2. O servidor cria um carrinho novo e devolve o token de duas formas **redundantes**: no header de resposta `x-cart-token` **e** no campo `token` do corpo JSON. Use qualquer um dos dois — o campo `token` no body é o mais simples de ler.
3. Guarde esse token (ex.: `localStorage`) e envie-o em **todas as chamadas seguintes** via header `x-cart-token: <token>`.
4. **Importante:** o token tem que ser um UUID válido. Se você mandar um valor inválido (ou não mandar nenhum), o servidor **silenciosamente cria um carrinho novo** com um token novo — não dá erro, mas você perde o carrinho anterior sem perceber. Sempre reenvie exatamente o token que o servidor te deu.
5. O carrinho expira sozinho no Redis após um tempo de inatividade (`CART_TTL_SECONDS`, renovado a cada leitura) — não existe endpoint pra "ressuscitar" um carrinho expirado, ele simplesmente vira um carrinho vazio novo.

Esse mesmo token é usado depois no checkout guest (`x-cart-token` em `POST /orders/guest`, ver `05-checkout-guest.md`).

---

## `GET /cart`

Retorna o carrinho atual (vazio se não existir ainda / token inválido).

### Resposta `200`

```json
{
  "token": "1293261b-75f7-4044-a19d-02efc19a58f7",
  "items": [
    {
      "variantId": "dca9b8a1-ec2e-43fd-a1db-611ca2dcbd8d",
      "quantity": 1,
      "available": true,
      "sku": "DEV-0BC4044D-39",
      "price": 99.99,
      "stockAvailable": 10,
      "product": {
        "id": "c78bd3e5-...",
        "name": "Air Griffey Max 1 Freshwater",
        "slug": "nike-air-griffey-max-1-freshwater",
        "image": "https://.../foto.jpg",
        "brand": "Nike"
      }
    }
  ],
  "subtotal": 99.99,
  "updatedAt": "2026-07-30T01:04:21.315Z"
}
```

| Campo do item | Descrição |
|---|---|
| `available` | `false` se: variante/produto não existe mais, foi desativado, **ou não há estoque suficiente pra quantidade pedida** (exceto presale, que ignora estoque). Itens indisponíveis **não são removidos automaticamente** — o frontend decide como exibir (ex.: "indisponível, remover?") |
| `price` | Preço unitário — já resolve pra `presalePrice` automaticamente se o item está em presale |
| `stockAvailable` | `stockQuantity - reservedQuantity` da variante, `null` se `available: false` por variante inexistente |
| `product` | `null` se `available: false` por variante/produto inexistente |
| `subtotal` | Soma de `price * quantity` **só dos itens `available: true`** — itens indisponíveis não entram na conta |

---

## `POST /cart/items` — Adicionar item

### Body (`AddCartItemDto`)

```json
{ "variantId": "dca9b8a1-ec2e-43fd-a1db-611ca2dcbd8d", "quantity": 1 }
```

`quantity` mínimo `1`. Se o `variantId` já está no carrinho, a quantidade é **somada** (não substituída).

### Resposta `201`

Mesmo formato de `GET /cart`.

**Nota:** este endpoint não valida estoque no momento de adicionar — a validação de disponibilidade acontece na leitura (`available`/`stockAvailable` no `GET /cart`) e, de forma definitiva, na criação do pedido.

---

## `PATCH /cart/items/:variantId` — Alterar quantidade

### Body (`UpdateCartItemDto`)

```json
{ "quantity": 2 }
```

`quantity: 0` **remove o item** do carrinho (mesmo efeito de `DELETE /cart/items/:variantId`).

### Resposta `200`

Carrinho atualizado, mesmo formato de `GET /cart`.

---

## `DELETE /cart/items/:variantId`

Remove um item específico. Resposta `200` com o carrinho atualizado.

---

## `DELETE /cart`

Esvazia o carrinho inteiro (mesmo token, itens zerados). Resposta `200` com carrinho vazio.
