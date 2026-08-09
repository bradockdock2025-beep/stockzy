# Checkout de Cliente Autenticado

**Auth:** Todos os endpoints aqui exigem `Authorization: Bearer <accessToken>` (login em `06-autenticacao-cliente.md`).

**Pré-requisito de negócio:** o email do cliente precisa estar **verificado** antes de criar um pedido (`POST /customers/orders` chama `ensureCustomerEmailVerified` internamente) — se não estiver, a chamada falha. Ver `07-conta-cliente.md` pro fluxo de verificação.

Diferente do checkout guest, aqui **dois métodos de pagamento** são suportados: `cod` (confirmação manual por código) e `stripe`.

---

## `POST /customers/orders/quote` — Preview antes de finalizar

**Headers:** `x-cart-token` obrigatório (o carrinho do cliente logado — mesmo mecanismo de carrinho do resto da API, ver `04-carrinho.md`).

### Body (`CreateCustomerOrderDto`)

```json
{
  "addressId": "uuid-de-um-endereco-ja-cadastrado",
  "promoCode": "PROMO10",
  "paymentMethod": "stripe",
  "locale": "pt"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `addressId` | uuid | Não* | Endereço já salvo do cliente (`GET /customers/addresses`) |
| `shippingAddress` | object | Não* | Endereço "avulso", sem salvar — alternativa a `addressId` |
| `billingAddress` | object | Não | — |
| `promoCode` | string | Não | Código de cupom |
| `paymentMethod` | `cod` \| `stripe` | Não | — |
| `locale` | `pt`\|`fr`\|`en`\|`es` | Não | — |

*No quote, endereço não é obrigatório (só serve pra calcular frete se informado). **Na criação do pedido de fato (`POST /customers/orders`), um dos dois é obrigatório.**

### Resposta `201`

```json
{
  "items": [ { "variantId": "...", "productName": "...", "sku": "...", "quantity": 1, "unitPrice": "99.99", "totalPrice": "99.99" } ],
  "subtotal": 99.99,
  "shippingAmount": 0,
  "discountAmount": 10,
  "totalAmount": 89.99,
  "shippingAddress": { "...": "..." },
  "billingAddress": null,
  "promotion": { "id": "...", "name": "...", "type": "percent", "value": "10" }
}
```

---

## `POST /customers/orders` — Criar o pedido

**Headers:** `x-cart-token` obrigatório. `idempotency-key` (ou `x-idempotency-key`) **recomendado** — evita criar pedido duplicado em caso de retry de rede (a mesma chave, dentro de 24h, devolve o pedido já criado em vez de criar outro).

### Body

Mesmo `CreateCustomerOrderDto` do quote, com `addressId` **ou** `shippingAddress` agora obrigatório.

### Resposta `201`

```json
{
  "id": "...",
  "customerId": "...",
  "orderNumber": "STKZ-00010002",
  "status": "pending",
  "subtotal": "89.99",
  "shippingAmount": "0",
  "discountAmount": "10",
  "totalAmount": "89.99",
  "shippingAddress": { "...": "..." },
  "billingAddress": null,
  "locale": "pt",
  "createdAt": "...",
  "updatedAt": "...",
  "items": [ { "...": "..." } ],
  "customer": { "...": "..." },
  "payment": {
    "id": "...",
    "status": "awaiting_confirmation",
    "method": "cod",
    "confirmationCode": "123456",
    "confirmationCodeExpiresAt": "2026-07-30T04:00:00.000Z"
  }
}
```

**O bloco `payment` só vem preenchido quando `paymentMethod` é `cod`** (ou omitido — `cod` é o padrão se não especificado) **e** o ambiente tem `PAYMENT_CONFIRMATION_RETURN_CODE=true` (conveniência de dev/staging — em produção, o código normalmente vai só por SMS/email, não na resposta da API). Se `paymentMethod: "stripe"`, o pedido é criado **sem** pagamento associado ainda — o frontend precisa chamar `POST /customers/orders/:id/payment` em seguida (ver abaixo) pra gerar o `clientSecret` do Stripe.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `INSUFFICIENT_STOCK` | Estoque insuficiente no momento da criação |
| `400` | `PRESALE_LIMIT_REACHED` | Limite de presale atingido |
| `409` | — | Pedido já sendo processado (mesma `idempotency-key` em voo) |
| `401` | — | Email não verificado / token inválido |

---

## Pagamento — fluxo Stripe (cliente autenticado)

### `POST /customers/orders/:id/payment` — Gerar/obter o pagamento

**Headers:** `x-payment-method: stripe` (ou `cod`, padrão). `idempotency-key` recomendado.

Se já existe um pagamento pra esse pedido, devolve o mesmo (idempotente) em vez de criar de novo.

### Resposta `201`

```json
{
  "order": { "...": "..." },
  "payment": {
    "id": "...", "orderId": "...", "method": "stripe", "status": "pending",
    "amount": "89.99", "currency": "EUR",
    "clientSecret": "pi_..._secret_..."
  },
  "created": true
}
```

Passe `clientSecret` pro Stripe.js no frontend, igual ao fluxo guest (ver `05-checkout-guest.md`, seção "Confirmando o pagamento"). O webhook do Stripe cuida do resto (marcar `paid`, decrementar estoque, disparar email).

---

## Pagamento — fluxo COD (confirmação manual)

Pra pedidos `paymentMethod: "cod"`, o `payment.confirmationCode` (6 dígitos) já vem na criação do pedido (em dev/staging) ou é enviado por SMS/email (produção). O cliente confirma:

### `POST /customers/orders/:id/payment/confirm`

```json
{ "code": "123456" }
```

Confirma o pagamento COD com o código de 6 dígitos. Tem limite de tentativas (`PAYMENT_CONFIRMATION_MAX_ATTEMPTS`) e expiração (`PAYMENT_CONFIRMATION_TTL_HOURS`).

---

## `GET /customers/orders` — Listar meus pedidos

### Query params (`QueryOrderDto`)

| Param | Descrição |
|---|---|
| `status` | Filtra por `order_status` |
| `page` / `limit` | Paginação por página (padrão) |
| `cursor` | Alternativa: paginação por cursor (`nextCursor` na resposta) — use um ou outro, não os dois |

### Resposta `200` (modo página)

```json
{
  "data": [
    { "id": "...", "orderNumber": "STKZ-00010002", "status": "paid", "total": 89.99, "items": [...], "customer": {...}, "createdAt": "..." }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

Note: aqui o campo é `total` (number, já convertido), não `totalAmount` (string) como em outros lugares — inconsistência da API a ter em mente.

---

## `GET /customers/orders/:id` — Detalhe de um pedido

Mesmo shape do item de listagem, mais o campo `canBeCancelled: boolean` (indica se o status atual permite cancelamento).

---

## `GET /customers/orders/:id/tracking`

```json
{
  "id": "...", "orderNumber": "STKZ-00010002", "status": "shipped", "createdAt": "...",
  "shipment": {
    "id": "...", "carrier": "DHL", "trackingNumber": "...", "trackingUrl": "https://...",
    "estimatedDeliveryAt": "...", "shippedAt": "...", "deliveredAt": null, "status": "in_transit",
    "events": [
      { "status": "in_transit", "message": "Saiu para entrega", "location": "Paris", "occurredAt": "..." }
    ]
  }
}
```

`shipment` é `null` se ainda não há envio registrado. Só o **envio mais recente** vem aqui (se houver múltiplos, por reenvio/troca, só o último).

---

## `PATCH /customers/orders/:id/cancel`

Cancela o pedido, se o status atual permitir (`canBeCancelled: true` no detalhe). `idempotency-key` opcional. Sem body.
