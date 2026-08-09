# Newsletter e Cupons

Todos públicos, sem auth.

---

## `POST /newsletter/subscribe`

### Body

```json
{ "email": "cliente@example.com" }
```

### Resposta `201`

```json
{ "message": "Subscribed successfully" }
```

Reinscrever um email que já cancelou funciona normalmente (reativa). Erro `409` se o email já está inscrito e ativo.

---

## `POST /newsletter/unsubscribe`

### Body

```json
{ "email": "cliente@example.com" }
```

### Resposta `200`

```json
{ "message": "Unsubscribed successfully" }
```

Erro `404` se o email não está cadastrado (ou já cancelado).

---

## `GET /coupons/validate` — Validar cupom antes de aplicar

Use isso pra dar feedback imediato no campo de cupom do checkout, antes de efetivamente criar o pedido com `promoCode` (ver `08-checkout-cliente.md`).

### Query params

| Param | Obrigatório |
|---|---|
| `code` | Sim |

### Resposta `200` — cupom válido

```json
{
  "valid": true,
  "type": "percent",
  "value": 10,
  "minSubtotal": 50,
  "maxUsesPerCustomer": 1,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "label": "Promoção de Verão"
}
```

### Resposta `200` — cupom inválido/inexistente/expirado/esgotado

```json
{ "valid": false }
```

**Note que é sempre `200`, nunca `404`** — trate pelo campo `valid`, não pelo status HTTP. `type`: `percent` \| `fixed`. Esta rota **não verifica** se o subtotal atual do carrinho atinge `minSubtotal` nem se o cliente já usou o cupom antes (`maxUsesPerCustomer`) — essas checagens só acontecem de fato na criação do pedido. Trate esta validação como "o código existe e está ativo", não como garantia de aplicabilidade.
