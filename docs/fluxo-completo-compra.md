# Fluxo Completo de Compra — do Carrinho à Confirmação do Pedido

Este documento descreve o percurso ponta-a-ponta de uma compra na API, desde a criação do carrinho até à confirmação do pagamento e envio das notificações. Cobre tanto o fluxo de **cliente autenticado** como o de **guest checkout**.

## 1. Carrinho (`src/modules/cart/`)

O carrinho **não é uma entidade de base de dados** — é guardado inteiramente no Redis, sem distinção estrutural entre "guest" e "cliente autenticado":

- `CartService` grava um JSON `{ items: [{ variantId, quantity }], updatedAt }` na chave Redis `cart:{token}`, com TTL definido por `CART_TTL_SECONDS` (padrão: 7 dias).
- O token é um UUID gerado pelo servidor e devolvido/reenviado através do header `x-cart-token` (`cart.controller.ts:24-86`, endpoint público, sem autenticação).
- A distinção entre guest e cliente autenticado só acontece **no momento do checkout**, quando o token do carrinho é trocado por um pedido através de controllers/DTOs diferentes.

## 2. Início do Checkout (dois caminhos, mesmo carrinho)

### Cliente autenticado
`POST /customers/orders` → `OrdersCustomerController.create` → `OrdersService.createFromCustomerCart` (`orders.service.ts:146-355`).

Body (`CreateCustomerOrderDto`): `addressId` (ou endereço inline), `promoCode`, `paymentMethod` (`cod` | `stripe`), `locale`. Suporta idempotência via header `Idempotency-Key` / `X-Idempotency-Key`, com cache em Redis (`idempotency:orders:{authUserId}:{key}`) — lock de 600s enquanto processa, resultado guardado 24h.

### Guest
`POST /orders/guest` (exige `x-cart-token`) → `OrdersService.createGuestOrder` (`orders.service.ts:1377-1545`).

Body (`CreateGuestOrderDto`): telefone + código de país ISO (validado por regex). Este fluxo foi introduzido no commit de "guest checkout", com migração Prisma que adiciona `guestPhone`/`guestToken` ao `Order` e torna `customerId` opcional.

### Cálculo de preço (partilhado)
`buildCartQuote` (`orders.service.ts:1006-1150`, duplicado de forma inline no fluxo guest):

1. Lê variantes + inventário.
2. Bloqueia carrinhos que misturam itens de pré-venda com itens normais (`MIXED_CART_NOT_ALLOWED`).
3. Calcula `subtotal` a partir de `presalePrice` (se aplicável) ou `price`.
4. Chama `ShippingService.calculate` para o custo de envio.
5. Chama `resolvePromotion` para aplicar cupões/códigos promocionais (`discountAmount`).
6. `totalAmount = subtotal + shipping - discount` (nunca negativo).

## 3. Criação do Pedido — ANTES do pagamento, em estado `pending`

Ambos os caminhos correm dentro de uma única transação Prisma (`prisma.$transaction`):

1. Lock de linha no inventário (`SELECT ... FOR UPDATE`).
2. Verifica `stock_quantity - reserved_quantity >= quantidade_pedida`.
3. **Incrementa `reserved_quantity`** (não decrementa `stock_quantity` ainda) — é uma reserva "soft".
4. Cria o `Order` com `status: pending` (ou `presale`, se algum item for de pré-venda — com verificação adicional do limite agregado de pré-venda).
5. Cria os `OrderItem[]`.
6. Regista `PromotionUsage`, se aplicável.
7. No caminho cliente + COD, `PaymentsService.createForOrder` também é chamado dentro da mesma transação.

Após o commit:
- Enfileira `ordersQueue.enqueueOrderCreated`.
- Agenda um job de timeout de reserva (`enqueueReservationTimeoutIfNeeded`) — padrão `ORDER_RESERVATION_TIMEOUT_MINUTES` (30 min), ou alinhado com a expiração do código de confirmação no caso de COD.
- Limpa o carrinho no Redis.

**Máquina de estados do pedido** (`prisma/schema.prisma:585-594`):
`pending → paid | presale → processing → shipped → delivered → refunded`, com `cancelled` acessível a partir da maioria dos estados. As transições permitidas são controladas por uma whitelist em `OrdersService.updateStatus` (`orders.service.ts:806-813`).

## 4. Pagamento

Existem dois métodos: **Stripe** (confirmado por webhook) e **COD** (confirmado por código).

### Stripe — Guest
`createGuestOrder` chama imediatamente `PaymentsService.createGuestStripePayment(order.id)` (`payments.service.ts:243-284`), que cria um PaymentIntent no Stripe e um registo `Payment` (`status: pending`, com `clientSecret` e `metadata.stripePaymentIntentId`), devolvidos ao cliente junto com o `guestToken`.

### Stripe — Cliente autenticado
O pedido é criado `pending` **sem** registo de pagamento ainda. O frontend deve chamar separadamente `POST /customers/orders/:id/payment` com o header `x-payment-method: stripe` → `PaymentsService.createStripePaymentForOrder` (`payments.service.ts:101-241, 383-433`), também protegido por idempotência.

### Webhook Stripe
`POST /payments/stripe/webhook` (`stripe-webhook.controller.ts`, endpoint público, sem throttle) exige o corpo em raw e o header `stripe-signature` — assinatura inválida devolve `400`.

Eventos tratados:
- `payment_intent.succeeded` → `handleStripePaymentSucceeded`
- `payment_intent.payment_failed` → `handleStripePaymentFailed`
- Outros eventos são apenas registados/ignorados.

Erros no handler são capturados e enviados ao Sentry, mas o endpoint **sempre devolve `200 { received: true }`** para o Stripe não repetir o envio.

`handleStripePaymentSucceeded` (`payments.service.ts:286-357`) é **idempotente** (procura o `Payment` pelo `metadata.stripePaymentIntentId`; não faz nada se já estiver `paid`). Numa única transação:
1. `Payment.status = paid`.
2. `Order.status = paid` (não aplicável a pedidos de pré-venda).
3. Para pedidos guest, preenche `shippingAddress` a partir do objeto `shipping` devolvido pelo Stripe.
4. **Decrementa o `stock_quantity` real e liberta a `reserved_quantity`** — ou seja, o stock só é permanentemente descontado na confirmação do pagamento, nunca na criação do pedido.
5. Dispara os emails `order.created` + `payment.confirmed` para o cliente, e um email interno para a equipa (`dispatchInternal`).

### COD (pagamento na entrega/confirmação por código)
Não é confirmado por entrega física, mas por um código:

1. `createForOrder` (`payments.service.ts:48-99`) gera um código de confirmação com hash (TTL definido por `PAYMENT_CONFIRMATION_TTL_HOURS`, padrão 24h) e cria `Payment.status = awaiting_confirmation`.
2. O código só é devolvido na resposta da API quando `shouldReturnConfirmationCode()` é verdadeiro (ambiente não-produção, ou `PAYMENT_CONFIRMATION_RETURN_CODE=true`). Em produção o código é omitido — implica que é comunicado por outro canal (telefone/equipa operacional).
3. O cliente confirma via `POST /customers/orders/:id/payment/confirm` (`ConfirmPaymentDto { code }`) → `PaymentsService.confirmPayment` (`payments.service.ts:435-637`):
   - Valida o hash com `timingSafeEqual`.
   - Aplica limite de tentativas (`PAYMENT_CONFIRMATION_MAX_ATTEMPTS`, padrão 5 — ao exceder, `payment.status = failed`).
   - Verifica expiração (se expirado, `payment.status = expired`).
   - Em caso de sucesso: `Payment.status = paid`, `Order.status = paid`, e decremento de stock igual ao fluxo Stripe.

> **Nota de possível lacuna:** ao contrário do fluxo Stripe, `confirmPayment` não dispara `notificationsService.dispatch` para `order.created`/`payment.confirmed`. O job `order.created` é enfileirado antes, na criação do pedido, mas o worker atual apenas regista o evento e não envia email nesse ponto. Vale confirmar se isto é intencional.

## 5. Pós-compra / Notificações (`src/modules/notifications/`)

Disparo assíncrono (`void notificationsService.dispatch(...)`) que enfileira numa fila BullMQ (Redis), consumida por `NotificationsWorker`. Este renderiza templates Handlebars (localizados em `src/modules/notifications/templates/`, copiados para `dist/` no build) e envia via Resend (`MAIL_PASS`, `MAIL_FROM`).

Eventos suportados (com assuntos em pt/fr/en/es): `order.created`, `payment.confirmed`, `payment.failed`, `order.shipped`, `order.delivered`, `order.cancelled`, `presale.confirmed`, `presale.fulfilled`, `presale.cancelled`.

Emails internos (`dispatchInternal` / `dispatchInternalCancelled`) são enviados para `INTERNAL_NOTIFY_EMAIL` (padrão `teams@stockzy.com`).

## 6. Casos de erro / edge cases

| Situação | Comportamento |
|---|---|
| Stock insuficiente no checkout | `400 INSUFFICIENT_STOCK` |
| Limite de pré-venda esgotado | `400 PRESALE_LIMIT_REACHED` |
| Itens indisponíveis/inconsistentes | `ITEMS_UNAVAILABLE` / `INVENTORY_UNAVAILABLE` |
| Carrinho misto (pré-venda + normal) | `400 MIXED_CART_NOT_ALLOWED` |
| Checkout abandonado | Job de timeout de reserva (`OrdersQueueWorker`) chama `releaseReservationIfPending`, que só age se `order.status === pending` — cancela o pedido e liberta a `reserved_quantity` |
| Assinatura de webhook inválida | `400 Invalid signature`, sem alteração de estado |
| Falha de pagamento (Stripe) | `Payment.status = failed` + email `payment.failed`; o pedido continua `pending`/reservado até o job de timeout o cancelar (não há cancelamento automático imediato) |
| Cancelamento (cliente ou admin) | `cancelForCustomer` / `remove` reutilizam `cancelOrder` — libertam a reserva, marcam pagamentos não pagos como `cancelled`, disparam `order.cancelled` + email interno |

## Resumo do fluxo

```
Carrinho (Redis, token x-cart-token)
   │
   ▼
Checkout (cliente ou guest) → cálculo de preço (subtotal + envio - desconto)
   │
   ▼
Criação do Order em transação (status: pending) + reserva de stock (reserved_quantity++)
   │
   ▼
Pagamento
   ├─ Stripe → PaymentIntent → webhook payment_intent.succeeded → Order.status = paid, stock decrementado de facto
   └─ COD → código de confirmação → cliente confirma → Order.status = paid, stock decrementado de facto
   │
   ▼
Notificações assíncronas (email cliente + email interno via fila BullMQ/Resend)
```

**Ponto-chave arquitetural:** o stock é apenas *reservado* (não descontado) na criação do pedido, e só é *efetivamente descontado* na confirmação do pagamento — seja por webhook Stripe, seja por confirmação de código COD. Pedidos não confirmados a tempo são cancelados automaticamente e a reserva é libertada.
