# Checkout Dual Flow — Documentação Técnica

**Versão:** 1.0  
**Data:** Junho 2026  
**Contexto:** Implementação de guest checkout para o mercado francês, mantendo o fluxo de cliente autenticado existente.

---

## 1. Visão Geral

A Stockzy opera com dois fluxos de compra paralelos que coexistem sem conflito:

| | Fluxo Autenticado | Fluxo Guest |
|---|---|---|
| **Quem usa** | Clientes com conta | Qualquer pessoa |
| **Autenticação** | JWT Bearer Token | Nenhuma |
| **Identificação** | `customerId` (UUID) | `guestToken` (UUID) |
| **Campos obrigatórios** | Login + morada | Nome, telefone, morada |
| **Email** | Obrigatório (conta) | Não existe |
| **Histórico de pedidos** | Sim | Não |
| **Wishlist / Moradas guardadas** | Sim | Não |
| **Endpoint de criação** | `POST /customers/orders` | `POST /orders/guest` |

Ambos os fluxos partilham o mesmo carrinho (por `x-cart-token`), o mesmo Stripe e os mesmos templates de email.

---

## 2. Carrinho — Ponto de Partida Comum

O carrinho já funciona sem autenticação através do header `x-cart-token`. Este token é gerado automaticamente pelo frontend na primeira visita e mantido até ao checkout.

```
x-cart-token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Tanto o cliente autenticado como o guest usam o mesmo mecanismo de carrinho — **não há alteração nesta camada**.

---

## 3. Fluxo Autenticado (Existente)

### 3.1 Sequência

```
1. Cliente faz login → recebe JWT
2. Adiciona produtos ao carrinho (x-cart-token)
3. No checkout → POST /customers/orders
   Header: Authorization: Bearer <JWT>
   Header: x-cart-token: <token>
4. Recebe orderId
5. POST /customers/orders/:orderId/payment → Stripe PaymentIntent
6. Cliente paga no frontend (Stripe Elements)
7. Webhook Stripe confirma → email de confirmação enviado
```

### 3.2 Identificação do Pedido

```
orders.customerId = UUID  ← associado à conta do cliente
orders.guestToken  = null
orders.guestName   = null
orders.guestPhone  = null
orders.guestEmail  = null
```

### 3.3 Acesso ao Pedido Pós-Compra

O cliente acede aos seus pedidos via:
```
GET /customers/orders
GET /customers/orders/:orderId
Authorization: Bearer <JWT>
```

---

## 4. Fluxo Guest (Novo)

### 4.1 Sequência

```
1. Visitante entra no site sem criar conta
2. Adiciona produtos ao carrinho (x-cart-token)
3. No checkout → preenche formulário mínimo:
     - Nome completo
     - Telefone (WhatsApp) ← obrigatório
     - Email               ← opcional
     - Morada de entrega
4. POST /orders/guest
   Header: x-cart-token: <token>
   (sem Authorization)
5. Recebe { orderId, guestToken }
6. POST /orders/guest/:orderId/payment → Stripe PaymentIntent
7. Cliente paga no frontend (Stripe Elements)
8. Webhook Stripe confirma:
     → Se guestEmail fornecido: email de confirmação enviado
     → guestPhone guardado para suporte WhatsApp
```

### 4.2 Identificação do Pedido

```
orders.customerId = null   ← sem conta
orders.guestToken = UUID   ← chave de acesso ao pedido
orders.guestName  = "Marie Dupont"
orders.guestPhone = "+33612345678"
```

### 4.3 Acesso ao Pedido Pós-Compra

O guest acede ao seu pedido via token público:
```
GET /orders/guest/:orderId?token=<guestToken>
```
Sem autenticação. O `guestToken` valida o acesso.

---

## 5. Estrutura da Base de Dados

### 5.1 Campos Novos em `orders`

```sql
ALTER TABLE orders ADD COLUMN guest_name   TEXT;
ALTER TABLE orders ADD COLUMN guest_phone  TEXT;
ALTER TABLE orders ADD COLUMN guest_token  TEXT UNIQUE;
```

### 5.2 Regra de Integridade

Um pedido é sempre de um tipo ou do outro — nunca os dois:

```
CHECK (
  (customer_id IS NOT NULL AND guest_token IS NULL)
  OR
  (customer_id IS NULL AND guest_token IS NOT NULL)
)
```

---

## 6. Endpoints

### 6.1 Endpoints Existentes (sem alteração)

| Método | Rota | Auth |
|---|---|---|
| `POST` | `/customers/orders` | JWT |
| `GET` | `/customers/orders` | JWT |
| `GET` | `/customers/orders/:id` | JWT |
| `POST` | `/customers/orders/:id/payment` | JWT |
| `POST` | `/customers/orders/:id/payment/confirm` | JWT |
| `PATCH` | `/customers/orders/:id/cancel` | JWT |

### 6.2 Endpoints Novos (Guest)

| Método | Rota | Auth |
|---|---|---|
| `POST` | `/orders/guest` | `x-cart-token` |
| `GET` | `/orders/guest/:id?token=` | `guestToken` (query) |
| `POST` | `/orders/guest/:id/payment` | `guestToken` (body) |
| `POST` | `/orders/guest/:id/payment/confirm` | `guestToken` (body) |
| `PATCH` | `/orders/guest/:id/cancel` | `guestToken` (body) |

### 6.3 Body — POST /orders/guest

```json
{
  "name": "Marie Dupont",
  "phone": "+33612345678",
  "shippingAddress": {
    "street": "12 Rue de Rivoli",
    "city": "Paris",
    "zipcode": "75001",
    "country": "FR"
  },
  "locale": "fr"
}
```

**Campos obrigatórios:** `name`, `phone`, `shippingAddress`  
Sem email — o contacto é exclusivamente por telefone/WhatsApp.

### 6.4 Resposta — POST /orders/guest

```json
{
  "orderId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "orderNumber": "STKZ-00010123",
  "guestToken": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
}
```

O frontend deve guardar o `guestToken` para permitir a consulta do pedido.

---

## 7. Webhook Stripe — Lógica de Discriminação

Quando o Stripe confirma um pagamento, o webhook identifica o tipo de pedido:

```typescript
const order = await prisma.order.findUnique({ where: { id: orderId } });

if (order.customerId) {
  // Fluxo autenticado — comportamento actual
  await notificationsService.dispatch('order.created', orderId);
  await notificationsService.dispatch('payment.confirmed', orderId);
} else {
  // Fluxo guest — sem email, sem notificação automática
  // Confirmação mostrada na página de sucesso do frontend
  // guestPhone disponível para suporte WhatsApp
}

// Notificação interna (teams) — sempre, para ambos os fluxos
await notificationsService.dispatchInternal(orderId);
```

---

## 8. Decisão do Frontend

O frontend apresenta as duas opções no ecrã de checkout:

```
┌─────────────────────────────────────────────┐
│                                             │
│   Já tem conta?       [Entrar →]            │
│                                             │
│   ──────────── ou ────────────              │
│                                             │
│   [Comprar sem criar conta →]               │
│                                             │
└─────────────────────────────────────────────┘
```

**Opção "Entrar"** → fluxo autenticado existente  
**Opção "Comprar sem criar conta"** → formulário guest com 4 campos → `POST /orders/guest`

---

## 9. Emails e Notificações

| Evento | Cliente com conta | Guest |
|---|---|---|
| Pedido confirmado | ✅ Email ao cliente | ❌ (sem email ao cliente) |
| Pagamento confirmado | ✅ Email ao cliente | ❌ (sem email ao cliente) |
| Pedido enviado | ✅ Email ao cliente | ❌ (sem email ao cliente) |
| Recibo PDF | ✅ Email ao cliente | ❌ (sem email ao cliente) |
| **Notificação interna Teams Stockzy** | ✅ **Sempre** | ✅ **Sempre** |
| Página de confirmação pós-pagamento | ✅ | ✅ (mostra orderId + guestToken) |
| Suporte WhatsApp | Via conta | Via `guestPhone` |

O guest recebe a confirmação visualmente na página de sucesso do checkout. O contacto pós-venda é feito exclusivamente por WhatsApp através do `guestPhone`.

---

### Notificação Interna — Regra Crítica

> **A equipa Stockzy recebe obrigatoriamente um email de notificação para TODA e qualquer compra — seja de cliente com conta ou de guest checkout. Sem excepção.**

Este email interno é o mecanismo central de operações: é a partir dele que a equipa toma conhecimento do pedido e inicia o processo de preparação e entrega.

O email interno inclui, para pedidos guest:

| Campo | Fonte |
|---|---|
| Nome do comprador | `guestName` |
| Telefone (WhatsApp) | `guestPhone` |
| Morada de entrega | `shippingAddress` |
| Produtos e quantidades | `order.items` |
| Valor total | `order.totalAmount` |
| Número do pedido | `order.orderNumber` |
| Tipo de pedido | Badge "🛍 Nova venda — Guest" |

O `guestPhone` deve estar em destaque no email interno para facilitar o contacto via WhatsApp em caso de necessidade durante a preparação ou entrega.

**Implementação no webhook Stripe:**

```typescript
// Notificação interna — SEMPRE, independente do tipo de pedido
await notificationsService.dispatchInternal(orderId);
// Esta linha executa para clientes com conta E para guests
```

---

## 10. Segurança

| Ponto | Medida |
|---|---|
| Acesso ao pedido guest | `guestToken` UUID obrigatório — sem token, sem acesso |
| Criação de pedidos falsos | Rate limiting por IP em `POST /orders/guest` |
| Formato do telefone | Validação E.164 (`+` + código país + número) |
| RGPD | `guestPhone` e `guestEmail` são dados pessoais — sujeitos à política de retenção e direito ao esquecimento |
| `guestToken` em URL | Aceitável para consulta pública; não deve ser usado em logs de servidor |

---

## 11. Evolução Futura

Com o `guestPhone` guardado, a Stockzy pode evoluir para:

1. **WhatsApp Business API** — confirmação de pedido e rastreio directamente no WhatsApp
2. **Conversão de guest em cliente** — no pós-venda: *"Quer guardar os seus dados para a próxima compra?"*
3. **Associação de pedidos** — se o guest criar conta com o mesmo email/telefone, migrar o histórico de pedidos para a nova conta
4. **Suporte proactivo** — equipa Stockzy contacta o guest via WhatsApp para confirmar entrega ou resolver problemas

---

## 12. Resumo de Implementação

| Etapa | O que fazer |
|---|---|
| 1 | Migração Prisma — campos `guestName`, `guestPhone`, `guestEmail`, `guestToken` em `orders` |
| 2 | `GuestOrdersController` + `GuestOrdersService` — criar pedido sem conta |
| 3 | Adaptar `PaymentsService` — suporte a `guestToken` em vez de JWT |
| 4 | Webhook Stripe — discriminar pedido autenticado vs. guest |
| 5 | `NotificationsService` — `dispatchGuest()` com `guestName` e `guestEmail` |
| 6 | Endpoint de consulta `GET /orders/guest/:id?token=` |
| 7 | Frontend — ecrã de escolha + formulário guest com 4 campos |
