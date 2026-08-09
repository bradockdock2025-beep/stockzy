# Guest Checkout — Guia de Implementação Frontend

**Versão:** 1.0  
**Data:** Junho 2026  
**Destinatários:** Equipa Frontend  
**Pré-requisito:** Backend já implementado e deployado.

---

## Estado actual

O backend está 100% pronto. O frontend precisa de implementar 3 ecrãs:

1. **Modal 1** — recolha de país e telefone (formulário Stockzy)
2. **Modal 2** — pagamento (formulário Stripe nativo)
3. **Página de sucesso** — confirmação do pedido

---

## Fluxo resumido

```
Carrinho → Botão "Comprar agora" → Modal 1 → Modal 2 (Stripe) → Página de sucesso
```

O cliente nunca precisa de criar conta nem fazer login.

---

## O que o backend devolve

### Cabeçalho obrigatório em todas as chamadas

O `x-cart-token` identifica o carrinho do cliente. Deve estar presente em todas as chamadas ao backend de guest checkout. Este token já existe no frontend — é o mesmo que é usado para gerir o carrinho.

---

## Modal 1 — País e Telefone

### Campos a apresentar

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| País | Select / Dropdown | Sim | Código ISO 2 letras (ex: `FR`, `PT`, `AO`) |
| Telefone | Input texto | Sim | Formato internacional — ex: `+33612345678` |

### Validações do lado frontend

- Telefone deve começar por `+` e ter entre 7 e 15 dígitos
- País não pode estar vazio

### Chamada ao backend ao submeter o Modal 1

- **Método:** `POST`
- **Endpoint:** `/orders/guest`
- **Cabeçalho obrigatório:** `x-cart-token: <token do carrinho>`
- **Body:**
  ```
  phone   → número de telefone com código do país
  country → código ISO do país seleccionado (2 letras, maiúsculas)
  locale  → idioma do utilizador (ex: "fr", "pt", "en")
  ```

### O que o backend devolve (guardar em estado local)

```
orderId       → ID do pedido criado
orderNumber   → número do pedido visível (ex: #ORD-0042)
guestToken    → token UUID de acesso ao pedido
clientSecret  → chave para inicializar o Stripe Payment Element
publishableKey → chave pública Stripe para inicializar o SDK
```

**Guardar todos estes valores** — são necessários nos passos seguintes.

### Possíveis erros do backend

| Código | Mensagem | O que mostrar ao utilizador |
|---|---|---|
| `CART_EMPTY` | Cart is empty | "O seu carrinho está vazio." |
| `ITEMS_UNAVAILABLE` | Some items are unavailable | "Alguns artigos já não estão disponíveis." |
| `INSUFFICIENT_STOCK` | Insufficient stock | "Stock insuficiente para um ou mais artigos." |
| `PRESALE_NOT_ALLOWED` | Presale items cannot be purchased as guest | "Artigos em pré-venda requerem conta. Por favor crie uma conta." |

---

## Modal 2 — Stripe Payment Element

### O que fazer com o `clientSecret` e `publishableKey`

Ao abrir o Modal 2, o frontend deve:

1. Inicializar o SDK Stripe com o `publishableKey` recebido
2. Criar uma instância `Elements` usando o `clientSecret`
3. Montar o `PaymentElement` dentro do modal

### Configuração do Payment Element

Ao montar o Payment Element, activar a recolha de:

- **Endereço de entrega** (`shipping`) — obrigatório para a entrega
- **Nome completo** (`billing_details.name`) — obrigatório
- **Email** — deixar como o Stripe configurar por defeito (opcional para o cliente)

> O Stripe já apresenta Apple Pay e Google Pay automaticamente se o dispositivo suportar — não é necessário fazer nada extra.

### Resumo do pedido

Ao lado ou acima do formulário Stripe, mostrar:

- Artigos do carrinho (nome, quantidade, preço)
- Subtotal
- Custo de envio
- **Total a pagar**

### Após o pagamento ser confirmado pelo Stripe

O Stripe chama `stripe.confirmPayment()` e redirige ou emite um evento de sucesso. Quando o pagamento for bem sucedido, navegar para a **Página de Sucesso**.

---

## Página de Sucesso

### Dados a mostrar

Usar o `orderId` e o `guestToken` guardados no passo anterior para chamar:

- **Método:** `GET`
- **Endpoint:** `/orders/guest/{orderId}?token={guestToken}`
- **Sem cabeçalho de autenticação** — o token na query string é suficiente

### O que apresentar ao cliente

| Informação | Fonte |
|---|---|
| Número do pedido | `order.orderNumber` |
| Estado do pedido | `order.status` |
| Lista de artigos | `order.items` |
| Total pago | `order.totalAmount` |
| Endereço de entrega | `order.shippingAddress` (preenchido pelo Stripe) |
| Mensagem de contacto | "Entraremos em contacto pelo WhatsApp para confirmar a entrega." |

### Atenção — timing do webhook

O backend actualiza o pedido em dois momentos distintos:

| Momento | O que acontece |
|---|---|
| Imediatamente após `POST /orders/guest` | `shippingAddress` contém apenas `{ country: "FR" }` — endereço incompleto |
| Após o webhook Stripe disparar (segundos depois do pagamento) | `shippingAddress` é preenchido com morada completa e `status` passa a `paid` |

**O que o frontend deve fazer na página de sucesso:**

- Mostrar sempre o `orderNumber` e os artigos — esses dados estão disponíveis de imediato
- Para o endereço de entrega e o estado `paid`, fazer uma segunda chamada ao `GET /orders/guest/:id?token=` com um pequeno atraso (2 a 3 segundos) ou mostrar uma mensagem intermédia como "A confirmar pagamento..."
- Não bloquear a página de sucesso à espera do estado `paid` — o Stripe já confirmou o pagamento ao cliente; o webhook é processamento interno

### Guardar `guestToken` localmente

O `guestToken` deve ser guardado no `localStorage` ou `sessionStorage` para que o cliente possa voltar a consultar o pedido mais tarde (ex: fechar e reabrir o browser).

---

## Estados do pedido (`order.status`)

| Valor | Significado |
|---|---|
| `pending` | Pedido criado, aguarda pagamento |
| `paid` | Pagamento confirmado |
| `processing` | Em preparação |
| `shipped` | Enviado |
| `delivered` | Entregue |
| `cancelled` | Cancelado |

---

## Regras importantes

1. **Não pedir email ao cliente** — o email não é campo Stockzy no guest checkout. Se o Stripe o pedir no formulário, é responsabilidade do Stripe.

2. **Não criar conta obrigatória** — o fluxo guest deve funcionar do início ao fim sem qualquer autenticação.

3. **O `x-cart-token` é o mesmo do carrinho** — não gerar um novo. Usar o que já existe na sessão do utilizador.

4. **Após o `POST /orders/guest` ter sucesso, o carrinho é limpo automaticamente pelo backend** — o frontend não precisa de fazer nada extra.

5. **O `guestToken` é o único meio de aceder ao pedido** — tratar como dado sensível. Não expor em URLs partilháveis sem aviso ao utilizador.

---

## Sequência de chamadas resumida

```
1. [Carrinho] Utilizador clica "Checkout"
   → Abrir Modal 1

2. [Modal 1] Utilizador preenche país + telefone e clica "Continuar"
   → POST /orders/guest  (com x-cart-token no cabeçalho)
   → Guardar: orderId, orderNumber, guestToken, clientSecret, publishableKey

3. [Modal 2] Inicializar Stripe com clientSecret + publishableKey
   → Montar Payment Element com recolha de morada + nome
   → Utilizador preenche dados e clica "Pagar"
   → Stripe processa

4. [Stripe OK] Navegar para Página de Sucesso
   → GET /orders/guest/{orderId}?token={guestToken}
   → Mostrar confirmação ao utilizador
   → Guardar guestToken em localStorage
```

---

## Contacto para dúvidas de integração

Para questões sobre os endpoints ou dados devolvidos pelo backend, contactar a equipa backend com referência a este guia e ao ficheiro `docs/guest-checkout-stripe-flow.md`.
