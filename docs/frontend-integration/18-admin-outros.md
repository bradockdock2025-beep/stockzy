# Admin — Promoções, Auditoria e Rate-Limit

**Auth:** JWT admin. Promoções: role **só `admin`**. Audit-logs e rate-limit-audits: `admin` ou `manager`.

---

## Promoções — `/admin/promotions` (role: só `admin`)

| Método | Rota | Body/Query |
|---|---|---|
| `POST` | `/admin/promotions` | `CreatePromotionDto` |
| `GET` | `/admin/promotions` | `QueryPromotionDto`: `isActive`, `search`, `code`, `page`/`limit` ou `cursor` |
| `GET` | `/admin/promotions/:id` | — |
| `PATCH` | `/admin/promotions/:id` | Parcial |
| `PATCH` | `/admin/promotions/:id/deactivate` | — |

### `CreatePromotionDto`

```json
{
  "name": "Promoção de Verão",
  "code": "VERAO10",
  "type": "percent",
  "value": 10,
  "isActive": true,
  "startsAt": "2026-08-01",
  "endsAt": "2026-08-31",
  "priority": 1,
  "minSubtotal": 50,
  "maxUses": 100,
  "maxUsesPerCustomer": 1,
  "label": "oferta_do_dia",
  "targets": [
    { "type": "category", "categoryId": "uuid" }
  ]
}
```

| Campo | Descrição |
|---|---|
| `type` | `percent` \| `fixed` |
| `code` | Se preenchido, cliente precisa digitar o código (`GET /coupons/validate`, `08-checkout-cliente.md`). Se `null`/omitido, é uma promoção **automática** (aplicada sem código, ex.: campanhas de vitrine em `GET /products/offers`) |
| `priority` | Maior prioridade vence quando há mais de uma promoção aplicável — só **1 promoção por pedido** (regra de negócio) |
| `label` | Campo livre — `"oferta_do_dia"` é usado especificamente por `GET /products/offers?type=daily` (ver `02-produtos.md`) pra filtrar a "oferta do dia" |
| `targets[].type` | `cart` (aplica no carrinho todo, sem alvo específico) \| `product` (`productId` obrigatório) \| `category` (`categoryId` obrigatório, inclui subcategorias) |

---

## Audit Log — `GET /admin/audit-logs` (role: `admin`, `manager`)

Trilha de auditoria de todas as ações administrativas (quem criou/editou/apagou o quê).

### Query params (`QueryAuditLogDto`)

| Param | Descrição |
|---|---|
| `actorId` / `actorEmail` | Filtra por quem fez a ação |
| `action` | Ex.: `"login"`, `"payment.paid"`, `"category.create"` — string livre, depende do que foi logado |
| `entity` / `entityId` | Filtra por tipo/id da entidade afetada |
| `from` / `to` | Janela de data (ISO) |
| `limit` | Máx 200 |
| `cursor` | Paginação por cursor |

---

## Auditoria de rate-limit de login — `GET /admin/login-rate-limit-audits` (role: `admin`, `manager`)

Histórico de bloqueios/tentativas de login excessivas (tanto admin quanto cliente, pelo que indica o sistema de rate limit compartilhado — ver `LOGIN_RATE_LIMIT_*` no `.env`).

### Query params (`QueryLoginRateLimitAuditDto`)

| Param | Descrição |
|---|---|
| `email` | Filtra por email alvo da tentativa |
| `ip` | Filtra por IP de origem |
| `from` / `to` | Janela de data (ISO) |
| `limit` | Máx 200 |
| `cursor` | Paginação por cursor |
