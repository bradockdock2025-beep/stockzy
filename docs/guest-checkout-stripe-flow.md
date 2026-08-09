# Guest Checkout — Análise Actualizada (Abordagem Stripe-First)

**Versão:** 2.0  
**Data:** Junho 2026  
**Referência de inspiração:** one54africa.com  
**Princípio:** Usar o que o Stripe já oferece — sem reinventar formulários.

---

## 1. Insight Principal

O Stripe já recolhe nativamente no seu formulário de pagamento:

- **Email** (pode ser opcional conforme configuração)
- **Nome completo**
- **Endereço de entrega**
- **Dados do cartão** (número, validade, CVC)
- **Apple Pay / Google Pay** (pagamento com 1 toque para quem tem cartão guardado no telemóvel)

Isto significa que **não precisamos de construir um formulário de checkout do zero**. O nosso formulário antes do Stripe é mínimo — recolhemos apenas o que o Stripe não recolhe: o **número de telefone (WhatsApp)**.

---

## 2. O que o Stockzy Recolhe vs. O que o Stripe Recolhe

| Campo | Quem recolhe | Obrigatório |
|---|---|---|
| País de origem | Stockzy (modal 1) | ✅ Sim |
| Telefone (WhatsApp) | Stockzy (modal 1) | ✅ Sim |
| Email | Stripe (formulário) | Depende da config Stripe |
| Nome completo | Stripe (formulário) | ✅ Sim (Stripe) |
| Endereço de entrega | Stripe (formulário) | ✅ Sim (Stripe) |
| Dados do cartão | Stripe (formulário) | ✅ Sim (Stripe) |
| Apple Pay / Google Pay | Stripe (formulário) | Alternativa rápida |

**O Stockzy só recolhe 2 campos antes do Stripe: país e telefone.**  
O resto é responsabilidade do Stripe.

---

## 3. Fluxo Completo Revisto

```
1. Cliente entra no site e escolhe produto
2. Adiciona ao carrinho → x-cart-token gerado automaticamente

3. Clica "Checkout"
   ↓
   MODAL 1 — "De onde está a comprar?"
   ┌─────────────────────────────────┐
   │  País        [🇫🇷 França    ▼]  │
   │  Telefone    [+33 _________ ]  │  ← WhatsApp obrigatório
   │                                 │
   │           [Continuar →]         │
   └─────────────────────────────────┘

4. POST /orders/guest (backend cria o pedido + PaymentIntent Stripe)
   → Recebe: { orderId, guestToken, clientSecret }

5. MODAL 2 — Stripe Payment Element (formulário Stripe nativo)
   ┌─────────────────────────────────┐
   │  Resumo do pedido               │
   │  Subtotal / Frete / Total       │
   │                                 │
   │  [Apple Pay]  [Google Pay]      │  ← pagamento rápido
   │  ─────── ou ───────             │
   │  Email (opcional)               │  ← Stripe recolhe
   │  Nome completo                  │  ← Stripe recolhe
   │  Endereço de entrega            │  ← Stripe recolhe
   │  Número do cartão               │  ← Stripe recolhe
   │                                 │
   │           [Pagar]               │
   └─────────────────────────────────┘

6. Stripe processa o pagamento
7. Webhook Stripe confirma → backend actualiza pedido com dados da entrega
8. Página de sucesso: mostra número do pedido + guestToken
9. Teams Stockzy recebe email interno com todos os dados
```

**Tempo estimado total: menos de 90 segundos.**

---

## 4. Stripe Payment Element vs. Stripe Checkout

Existem duas formas de usar o Stripe. A escolha afecta o controlo visual e o fluxo.

### Opção A — Stripe Payment Element (Recomendada)

O formulário Stripe é **embutido num modal da nossa página** — o cliente nunca sai do site Stockzy. É o que o one54africa usa.

**Vantagens:**
- Visual integrado com o design Stockzy
- O modal abre em cima da página do produto
- Controlo total sobre o layout à volta do formulário Stripe
- Pode-se exibir resumo do pedido, imagem do produto, etc.

**Como funciona:**
```
Frontend → cria PaymentIntent no backend → recebe clientSecret
         → inicializa Stripe Elements com clientSecret
         → monta o formulário dentro do modal
         → cliente paga → Stripe confirma → webhook dispara
```

### Opção B — Stripe Checkout (Hosted)

O cliente é **redirecccionado para uma página hospedada pelo Stripe**.

**Vantagens:**
- Zero implementação de formulário no frontend
- Stripe gere tudo (SSL, PCI, Apple Pay, etc.)

**Desvantagens:**
- Cliente sai do site Stockzy
- Menos controlo visual
- Não encaixa no conceito de modal inspirado no one54africa

**Recomendação: Opção A (Payment Element em modal)**

---

## 5. Email — Posição Actualizada

O email **não é campo nosso** — é o Stripe que o pede (ou não) conforme a configuração do PaymentIntent.

Opções disponíveis no Stripe:
- `receipt_email` no PaymentIntent → Stripe envia recibo automático por email
- `customer_creation: 'always'` → Stripe cria customer e guarda email
- Formulário sem email → possível se desactivarmos o campo

**Decisão:** Deixar o Stripe gerir o email como bem entender para o seu fluxo interno (recibo Stripe). Do lado Stockzy, **não pedimos nem armazenamos email do guest**. Se o Stripe pedir, é responsabilidade do Stripe — não interferimos.

---

## 6. Backend — O que Muda

### 6.1 Campos em `orders`

```
guestPhone   String?   — telefone WhatsApp recolhido no Modal 1
guestToken   String?   — UUID para acesso ao pedido sem conta
```

O endereço de entrega já existe na tabela `orders` (`shippingAddress`) — é preenchido com os dados que o Stripe nos devolve no webhook após o pagamento.

### 6.2 Endpoint `POST /orders/guest`

Recebe apenas o mínimo (Modal 1):

```json
{
  "phone": "+33612345678",
  "country": "FR",
  "locale": "fr"
}
```

O backend:
1. Valida o `x-cart-token` e carrega os itens do carrinho
2. Cria o pedido com `customerId = null`, `guestPhone`, `guestToken`
3. Cria um `PaymentIntent` no Stripe com o valor total
4. Devolve `{ orderId, guestToken, clientSecret }`

O `clientSecret` é usado pelo frontend para inicializar o Stripe Payment Element.

### 6.3 Webhook Stripe

Quando o pagamento é confirmado:
1. Localiza o pedido pelo `paymentIntentId`
2. Extrai o endereço de entrega dos dados Stripe (`shipping.address`)
3. Actualiza `order.shippingAddress` com esses dados
4. Marca o pedido como pago
5. Envia notificação interna à equipa Stockzy (email obrigatório)

```typescript
// Sempre — para qualquer tipo de pedido
await notificationsService.dispatchInternal(orderId);
```

---

## 7. Endereço de Entrega — Fluxo de Dados

```
Stripe Payment Element
  └── cliente preenche endereço
        └── Stripe guarda em PaymentIntent.shipping
              └── Webhook recebe evento payment_intent.succeeded
                    └── backend extrai shipping.address
                          └── guarda em orders.shippingAddress
```

Não precisamos de fazer nada extra — o Stripe já nos entrega o endereço no evento do webhook.

Para activar isto, o PaymentIntent deve ser criado com:
```typescript
await stripe.paymentIntents.create({
  amount: totalEmCentimos,
  currency: 'eur',
  shipping_required: true, // activa o campo de morada no Payment Element
});
```

---

## 8. Notificação Interna Teams Stockzy — Regra Imutável

**Todo o pedido confirmado pelo Stripe — autenticado ou guest — gera obrigatoriamente um email interno para a equipa Stockzy.**

Este email é o único mecanismo de operações para pedidos guest (não há email ao cliente). Deve conter:

| Campo | Fonte |
|---|---|
| Número do pedido | `order.orderNumber` |
| Telefone WhatsApp | `order.guestPhone` |
| Nome do cliente | Dados Stripe (`billing_details.name`) |
| Endereço de entrega | Dados Stripe (`shipping.address`) |
| Produtos | `order.items` |
| Total pago | `order.totalAmount` |
| Badge | "🛍 Nova venda — Guest" |

O `guestPhone` aparece em destaque para contacto imediato via WhatsApp se necessário durante a preparação ou entrega.

---

## 9. Resumo da Arquitectura

```
FRONTEND
├── Modal 1 (Stockzy)       → país + telefone
├── Modal 2 (Stripe)     → nome + email + morada + cartão / Apple Pay
└── Página de sucesso    → orderNumber + guestToken

BACKEND
├── POST /orders/guest   → cria pedido + PaymentIntent
├── Webhook Stripe       → confirma pagamento + extrai morada + notifica teams
└── GET /orders/guest/:id?token=   → consulta pública por token

BASE DE DADOS
└── orders
    ├── customerId  = null
    ├── guestPhone  = "+33612345678"
    ├── guestToken  = UUID
    └── shippingAddress = { dados vindos do Stripe }
```

---

## 10. Vantagens desta Abordagem

| | Abordagem anterior (formulário próprio) | Abordagem actual (Stripe-first) |
|---|---|---|
| Campos a construir | Nome, email, morada, cartão | Só país + telefone |
| Manutenção | Alta | Baixa (Stripe gere o formulário) |
| Apple Pay / Google Pay | Não | Sim (Stripe inclui automaticamente) |
| PCI Compliance | Responsabilidade nossa | Responsabilidade do Stripe |
| Tempo de implementação | Semanas | Dias |
| Experiência mobile | A construir | Nativa Stripe (optimizada) |

---

## 11. Prioridade de Implementação

| Etapa | O que fazer |
|---|---|
| 1 | Migração Prisma — `guestPhone`, `guestToken` em `orders` |
| 2 | `POST /orders/guest` — recebe país + telefone, cria pedido + PaymentIntent |
| 3 | Webhook Stripe — extrair morada dos dados Stripe + notificar teams |
| 4 | `GET /orders/guest/:id?token=` — consulta pública |
| 5 | Frontend Modal 1 — país + telefone |
| 6 | Frontend Modal 2 — Stripe Payment Element embutido |
| 7 | Página de sucesso — orderNumber + guestToken |
