# Guest Checkout — Análise de Abordagem

**Contexto:** Estudo de validação no mercado francês (Junho 2026)  
**Conclusão principal:** Clientes abandonam a compra ao ser obrigados a criar conta. A Stockzy precisa de permitir compra directa sem registo — rápida, com o mínimo de campos.

---

## 1. Problema Identificado

O funil de compra actual exige criação de conta antes de finalizar o pedido. No mercado francês, especialmente no segmento jovem (18–30), isso gera abandono imediato.

**O que o estudo mostrou:**
- O público jovem quer comprar em menos de 2 minutos
- Não querem passwords, não querem verificação de email, não querem formulários longos
- **O telefone é o canal principal** — usam WhatsApp para tudo: suporte, confirmações, rastreio
- Concorrentes directos (ASOS, Zara, Shein) já oferecem guest checkout nativo

---

## 2. Princípio Central da Nova Abordagem

> **Menos campos = mais conversão.**

O cliente fornece apenas o estritamente necessário para receber o produto e ser contactado:

| Campo | Obrigatório | Motivo |
|---|---|---|
| Nome completo | ✅ Sim | Identificação na entrega |
| Morada de entrega | ✅ Sim | Para enviar o produto |
| Número de telefone | ✅ Sim | Contacto principal — WhatsApp |

**Sem email. Sem password. Sem verificação. Sem conta.**

O email foi removido intencionalmente — o público jovem não usa email como canal principal e a presença do campo, mesmo opcional, gera dúvida sobre se é obrigatório ou não. Para não criar fricção, o campo não existe.

---

## 3. Porquê o Telefone é Central

- A geração jovem comunica por WhatsApp, não por email
- O número de telefone serve como identificador único do cliente guest
- Permite ao suporte da Stockzy contactar o cliente via WhatsApp em caso de problema com o pedido ou entrega
- Futuramente pode servir para envio de confirmação de pedido via WhatsApp Business API
- É mais confiável que o email (menos spam, leitura imediata)

---

## 4. O que Já Existe (aproveitar)

| Componente | Estado |
|---|---|
| Carrinho por token (`x-cart-token`) | ✅ Implementado |
| Stripe Payments | ✅ Implementado |
| Morada de entrega no pedido | ✅ Implementado |
| Templates de email (pt/fr/en/es) | ✅ Implementado |
| Recibo PDF por token HMAC | ✅ Implementado |

A base está quase toda pronta. O que falta é adaptar o fluxo de criação de pedido para aceitar um guest sem conta.

---

## 5. O que Precisa de Ser Criado

### 5.1 Base de Dados

Campos novos na tabela `orders` (todos nullable):

```
guestName        String?   — nome completo do guest
guestPhone       String?   — número de telefone (WhatsApp)
guestToken       String?   — token único para consulta do pedido sem conta
```

### 5.2 Endpoint de Criação (Guest)

```
POST /orders/guest
Header: x-cart-token: <token>
```

Body:
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

- Sem `Authorization` header
- `customerId = null`
- Gera `guestToken` (UUID aleatório) devolvido na resposta
- `phone` guardado para suporte via WhatsApp
- Sem email — o cliente é contactado exclusivamente por telefone/WhatsApp

### 5.3 Consulta do Pedido (Guest)

```
GET /orders/guest/:orderId?token=GUEST_TOKEN
```

- Sem autenticação
- Valida `guestToken` antes de devolver dados
- O cliente guarda o link recebido na página de confirmação (orderId + guestToken)

### 5.4 Pagamento Guest

```
POST /orders/guest/:orderId/payment
POST /orders/guest/:orderId/payment/confirm
```

Mesma lógica Stripe existente, mas autenticado por `guestToken` em vez de JWT.

---

## 6. Fluxo Completo (Guest)

```
1. Cliente entra no site
2. Escolhe produto → adiciona ao carrinho (x-cart-token automático)
3. Clica "Comprar agora"
4. Formulário (3 campos apenas):
     Nome           _______________
     Telefone       _______________  ← WhatsApp
     Morada         _______________
5. POST /orders/guest → recebe orderId + guestToken
6. Redireccionado para Stripe → pagamento em segundos
7. Webhook Stripe confirma pagamento
8. Suporte Stockzy contacta pelo WhatsApp se necessário
9. Cliente consulta estado via GET /orders/guest/:id?token=GUEST_TOKEN
```

**Tempo estimado para completar o checkout: menos de 2 minutos.**

---

## 7. Considerações de Segurança

| Risco | Mitigação |
|---|---|
| Enumeração de pedidos | `guestToken` UUID obrigatório para qualquer consulta |
| Pedidos falsos / spam | Rate limiting por IP no `POST /orders/guest` |
| Telefone inválido | Validação de formato internacional (E.164) |
| RGPD | Telefone e email são dados pessoais — política de retenção e anonimização necessária |

---

## 8. Potencial Futuro — WhatsApp Business

Com o telefone guardado, a Stockzy pode evoluir para:
- Envio de confirmação de pedido via WhatsApp (WhatsApp Business API)
- Notificação de expedição com número de rastreio via WhatsApp
- Suporte pós-venda directamente no WhatsApp
- Conversão do guest em cliente: "Quer guardar os seus dados para a próxima compra?"

---

## 9. Impacto Esperado

| Métrica | Estimativa |
|---|---|
| Redução de abandono no checkout | 25–40% |
| Aumento de conversão mercado FR | Significativo (entrada recente no mercado) |
| Tempo médio de checkout | < 2 minutos |
| Clientes guest convertidos em conta | Retomar via campanha WhatsApp/email |

---

## 10. Prioridade de Implementação

1. Migração Prisma — campos guest em `orders`
2. `POST /orders/guest` — criação de pedido sem conta
3. Pagamento guest — adaptar endpoints Stripe existentes
4. Webhook Stripe — identificar e processar pedidos guest
5. Email opcional de confirmação para guest
6. `GET /orders/guest/:id` — consulta por token
7. Frontend — formulário guest com 4 campos máximo
