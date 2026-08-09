# Checkout de Convidado (Guest)

Fluxo completo de compra **sem conta/login**. Já validado ponta a ponta nesta fase do backend, incluindo pagamento real via Stripe (test mode).

**Pré-requisito:** ter um carrinho com itens — ver `04-carrinho.md`. Todo endpoint aqui usa o header `x-cart-token` do carrinho.

## Fluxo completo (ordem recomendada)

```
1. Adicionar itens ao carrinho          → POST /cart/items (ver 04-carrinho.md)
2. Mostrar resumo antes de finalizar    → GET /orders/guest/quote
3. Criar o pedido                       → POST /orders/guest
4. Confirmar pagamento no Stripe        → stripe.confirmPayment() no frontend (Stripe.js), usando o clientSecret do passo 3
5. Consultar status do pedido           → GET /orders/guest/:id
```

---

## `GET /orders/guest/quote`

**Auth:** Público. **Headers:** `x-cart-token` obrigatório.

Preview do pedido antes de criar de fato — mostra subtotal, frete e total calculados, sem persistir nada. Use pra tela de resumo/checkout antes do usuário confirmar.

### Query params

| Param | Obrigatório | Descrição |
|---|---|---|
| `country` | Sim | Código do país (usado pro cálculo de frete) |

### Resposta `200`

```json
{
  "items": [
    {
      "variantId": "dca9b8a1-...",
      "productId": "c78bd3e5-...",
      "categoryId": "d4844604-...",
      "productName": "Air Griffey Max 1 Freshwater",
      "sku": "DEV-0BC4044D-39",
      "quantity": 1,
      "unitPrice": "99.99",
      "totalPrice": "99.99",
      "weightKg": null,
      "isPresale": false
    }
  ],
  "subtotal": "99.99",
  "shippingAmount": "0",
  "totalAmount": "99.99",
  "isPresaleOrder": false
}
```

Todos os valores monetários vêm como **string** aqui (não number) — converta com `Number(...)` no frontend.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `CART_EMPTY` | Carrinho vazio ou todos os itens indisponíveis |
| `400` | — | `x-cart-token` ou `country` faltando |

---

## `POST /orders/guest` — Criar o pedido

**Auth:** Público. **Headers:** `x-cart-token` obrigatório.

**Atenção — o que este endpoint NÃO pede:** não tem campo de email, nome ou endereço de entrega estruturado. Isso é intencional: o pedido guest é criado "mínimo" antes do pagamento, e o **email + endereço completo são preenchidos depois, pelo próprio Stripe**, no momento da confirmação de pagamento (via Stripe Elements/Checkout no frontend, que coleta esses dados). Não tente adicionar email/endereço no body — o DTO rejeita campos não esperados (`forbidNonWhitelisted: true`).

### Body (`CreateGuestOrderDto`)

```json
{
  "phone": "+33612345678",
  "country": "FR",
  "locale": "pt"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone` | string | Sim | Formato internacional, ex.: `/^\+?[1-9]\d{6,14}$/` |
| `country` | string | Sim | Código de país, 2 caracteres |
| `locale` | `pt`\|`fr`\|`en`\|`es` | Não | Idioma dos emails de notificação. Padrão `fr` |

### Resposta `201`

```json
{
  "orderId": "0b31d8db-f087-4586-a30d-e08b4c10027d",
  "orderNumber": "STKZ-00010001",
  "guestToken": "39aae252-fc6c-42db-99a8-334bb1365204",
  "clientSecret": "pi_3Tyir1EMzbJJimWs..._secret_...",
  "publishableKey": "pk_test_..."
}
```

| Campo | Descrição |
|---|---|
| `orderId` | Use pra consultar o pedido depois |
| `guestToken` | **Guarde isso** — é a "senha" pra consultar o pedido depois (`GET /orders/guest/:id?token=...`). Não é reenviável, não tem como recuperar se perder — se perder, o cliente não consegue mais consultar o pedido pela API (só pelo email de confirmação, quando chegar) |
| `clientSecret` | Passe pro Stripe.js no frontend (`stripe.confirmPayment({ clientSecret, ... })`) pra abrir o formulário de pagamento e coletar cartão + endereço + email |
| `publishableKey` | Chave pública do Stripe a usar no frontend (não precisa estar hardcoded no frontend, vem daqui) |

Ao criar o pedido, o **estoque já é reservado** (`reservedQuantity` incrementado) — antes mesmo do pagamento confirmar. Se o pagamento não for concluído, a reserva expira depois de um tempo (`ORDER_RESERVATION_TIMEOUT_MINUTES` no `.env`, hoje 30 min) e o pedido é cancelado automaticamente.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `CART_EMPTY` | Carrinho vazio |
| `400` | `INSUFFICIENT_STOCK` | Algum item não tem estoque suficiente no momento exato da criação |
| `400` | — | Validação de `phone`/`country` |

---

## Confirmando o pagamento (lado do frontend, fora desta API)

Depois de `POST /orders/guest`, o frontend usa o **Stripe.js** diretamente (não outro endpoint desta API):

```js
const stripe = await loadStripe(publishableKey);
const { error } = await stripe.confirmPayment({
  clientSecret,
  confirmParams: { return_url: 'https://seu-frontend.com/checkout/sucesso' },
});
```

O Stripe coleta cartão, endereço de entrega e email **na própria UI dele**. Quando o pagamento é confirmado, o Stripe chama um **webhook** desta API (`POST /payments/stripe/webhook`, uso interno — o frontend nunca chama isso diretamente), que:
1. Marca o pedido como `paid`
2. Preenche `shippingAddress` do pedido (nome, email, endereço) com os dados que o Stripe coletou
3. Decrementa o estoque de verdade (antes só estava reservado)
4. Dispara o email de confirmação do pedido

Ou seja: **o status do pedido só muda pra `paid` de forma assíncrona**, depois que o Stripe processa. O frontend deve ficar de olho no retorno do `confirmPayment()` e, se quiser, fazer polling em `GET /orders/guest/:id` até o status mudar (ou confiar no `return_url` + no email de confirmação).

---

## `GET /orders/guest/:id` — Consultar o pedido

**Auth:** Público, mas exige o `guestToken` recebido na criação.

### Query params

| Param | Obrigatório |
|---|---|
| `token` | Sim — o `guestToken` recebido em `POST /orders/guest` |

### Resposta `200`

```json
{
  "id": "0b31d8db-...",
  "customerId": null,
  "orderNumber": "STKZ-00010001",
  "status": "paid",
  "subtotal": "99.99",
  "shippingAmount": "0",
  "discountAmount": "0",
  "totalAmount": "99.99",
  "shippingAddress": {
    "name": "Cliente Convidado",
    "email": "cliente@example.com",
    "street": "10 Rue de Test",
    "street2": "",
    "city": "Paris",
    "zipcode": "75001",
    "country": "FR",
    "state": ""
  },
  "billingAddress": null,
  "locale": "pt",
  "guestPhone": "+33612345678",
  "createdAt": "2026-07-30T01:32:05.000Z",
  "updatedAt": "2026-07-30T01:32:06.185Z",
  "items": [
    { "id": "...", "variantId": "...", "productName": "...", "sku": "...", "quantity": 1, "unitPrice": "99.99", "totalPrice": "99.99" }
  ],
  "payment": { "status": "paid", "method": "stripe" }
}
```

`status` (`order_status`): `pending` (aguardando pagamento) → `paid` → `processing` → `shipped` → `delivered`, ou `cancelled` / `refunded` a qualquer momento. Antes do pagamento confirmar, `shippingAddress` só tem `{country}` — os outros campos aparecem depois que o Stripe confirma.

### Erros

| Status | Quando |
|---|---|
| `401` | `token` faltando |
| `404` | `id` não existe, ou `token` não corresponde a esse pedido |

---

## Recibo em PDF — limitação atual

`GET /orders/:id/receipt?token=<hmac>` gera o PDF do recibo, mas o `token` aqui é um HMAC assinado **gerado só no backend** (usado no link do email de confirmação) — **não há hoje um endpoint que devolva esse token pro frontend pedir sob demanda**. Ou seja: o botão "baixar recibo" na UI, se vocês quiserem um, só funciona a partir do link que chega por email — não dá pra montar esse link no frontend sozinho a partir do `orderId`. Se precisarem disso na conta do cliente, é um endpoint novo a pedir pro backend.
