# Admin — Pedidos, Pagamentos, Envios e Relatórios

**Auth:** JWT admin. Roles: `admin` ou `manager` em todos os endpoints deste arquivo, **exceto `/admin/reports/*`** que usa `x-admin-key` (API key fixa, não JWT — ver `00-visao-geral.md`).

---

## Pedidos — `/admin/orders`

| Método | Rota | Body/Query |
|---|---|---|
| `POST` | `/admin/orders` | `CreateOrderDto` — criação manual de pedido (uso raro; pedidos normalmente vêm do checkout guest/cliente) |
| `GET` | `/admin/orders` | `QueryOrderDto` (`status`, `customerId`, `page`/`limit` ou `cursor`) |
| `GET` | `/admin/orders/:id` | — |
| `PATCH` | `/admin/orders/:id` | `UpdateOrderDto` — edita qualquer campo, inclusive `items[]` |
| `PATCH` | `/admin/orders/:id/status` | `{ "status": "shipped" }` — só o `order_status` |
| `PATCH` | `/admin/orders/:id/cancel` | Cancela (idempotente via header `idempotency-key`) |
| `DELETE` | `/admin/orders/:id` | Mesmo efeito de cancelar (não é hard delete, apesar do verbo) |
| `POST` | `/admin/orders/presale/activate` | `{ "variantId": "uuid" }` — converte pedidos `presale` dessa variante em pedidos normais (quando o produto finalmente chega em estoque) |

`order_status`: `pending` → `paid` → `presale` → `processing` → `shipped` → `delivered`, ou `cancelled` / `refunded`.

---

## Pagamentos — `/admin/payments` (só leitura)

| Método | Rota | Query |
|---|---|---|
| `GET` | `/admin/payments` | `QueryPaymentDto`: `status` (`payment_status`), `orderId`, `customerId`, `page`/`limit` ou `cursor` |
| `GET` | `/admin/payments/:id` | — |

`payment_status`: `pending` → `paid`, ou `failed` \| `awaiting_confirmation` \| `cancelled` \| `expired`.

---

## Envios — `/admin/shipments`

| Método | Rota | Body |
|---|---|---|
| `POST` | `/admin/shipments` | `CreateShipmentDto` |
| `GET` | `/admin/shipments` | `QueryShipmentDto`: `orderId`, `status`, `trackingNumber`, `page`/`limit`, `cursor` |
| `GET` | `/admin/shipments/:id` | — |
| `PATCH` | `/admin/shipments/:id` | Parcial |
| `POST` | `/admin/shipments/:id/events` | `CreateShipmentEventDto` — adiciona um evento de rastreio |

### `CreateShipmentDto`

```json
{
  "orderId": "uuid",
  "status": "pending",
  "carrier": "DHL",
  "trackingNumber": "...",
  "trackingUrl": "https://...",
  "serviceLevel": "express",
  "shippedAt": null,
  "deliveredAt": null,
  "estimatedDeliveryAt": "2026-08-05",
  "metadata": {}
}
```

Só `orderId` é obrigatório. `shipment_status`: `pending` \| `shipped` \| `in_transit` \| `delivered` \| `failed` \| `returned` \| `cancelled`.

### `CreateShipmentEventDto`

```json
{ "status": "in_transit", "message": "Saiu para entrega", "location": "Paris", "occurredAt": "2026-07-30T10:00:00Z", "metadata": {} }
```

Cada evento fica no histórico (`GET /customers/orders/:id/tracking` no lado do cliente mostra isso, ver `08-checkout-cliente.md`).

---

## Relatórios — `/admin/reports` (⚠️ auth diferente: `x-admin-key`, não JWT)

```
GET /admin/reports/orders
x-admin-key: <ADMIN_API_KEY do .env>
```

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/reports/orders` | Mesma listagem de `/admin/orders`, mas via API key em vez de JWT — pensado pra integração externa/BI, não pro painel admin em si |
| `GET` | `/admin/reports/orders/:id` | Detalhe |
| `GET` | `/admin/reports/sales` | Resumo agregado (ver abaixo) |

### `GET /admin/reports/sales`

```json
{
  "totalOrders": 152,
  "totalRevenue": 15234.50,
  "byStatus": { "pending": 3, "paid": 120, "cancelled": 5, "shipped": 20, "delivered": 4 },
  "today": { "orders": 2, "revenue": 199.98 },
  "thisMonth": { "orders": 45, "revenue": 4521.30 },
  "recentOrders": [ /* últimos 10 pedidos, com customer e items resumidos */ ]
}
```
