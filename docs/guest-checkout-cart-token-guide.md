# Guest Checkout — Guia do x-cart-token (Frontend)

**Versão:** 1.0  
**Data:** Junho 2026  
**Destinatários:** Equipa Frontend  
**Contexto:** Este guia resolve o erro `CART_EMPTY` que ocorre ao chamar `POST /orders/guest`.

---

## O Problema

O erro `CART_EMPTY` acontece quando o `x-cart-token` enviado no `POST /orders/guest` não é o mesmo token com que os itens foram adicionados ao carrinho.

```json
{
  "code": "CART_EMPTY",
  "message": "Cart is empty"
}
```

---

## Como o x-cart-token funciona

O carrinho é identificado por um token UUID. Este token **não é gerado pelo frontend** — é gerado pelo backend na primeira chamada ao carrinho.

### Regra fundamental

> O `x-cart-token` é devolvido no **header da resposta** (não no body).  
> O frontend deve ler esse header e guardá-lo de imediato.

---

## Fluxo correcto — passo a passo

### 1. Primeira adição ao carrinho

O frontend chama `POST /cart/items` **sem enviar** o `x-cart-token` no request.

O backend responde com:
- **Header da resposta:** `x-cart-token: <uuid-gerado>`
- **Body da resposta:** os itens do carrinho

**O frontend deve:**
- Ler o valor do header `x-cart-token` da resposta
- Guardar esse valor em `localStorage` com a chave `cartToken` (ou equivalente no projecto)

---

### 2. Chamadas seguintes ao carrinho

Em todas as chamadas subsequentes ao carrinho (adicionar, remover, actualizar, consultar), o frontend deve:

- Ler o `cartToken` do `localStorage`
- Enviá-lo no header do request: `x-cart-token: <valor guardado>`

O backend devolve sempre o `x-cart-token` no header da resposta — o valor mantém-se o mesmo enquanto o carrinho existir.

---

### 3. Chamada ao guest checkout

Ao submeter o Modal 1 (país + telefone), o frontend deve:

- Ler o `cartToken` do `localStorage`
- Enviá-lo obrigatoriamente no header: `x-cart-token: <valor guardado>`
- Fazer `POST /orders/guest` com esse header

Se o token estiver correcto (o mesmo com que os itens foram adicionados), o backend responde com sucesso:

```
orderId        → ID do pedido
orderNumber    → número visível do pedido
guestToken     → token de acesso ao pedido
clientSecret   → para inicializar o Stripe Payment Element
publishableKey → chave pública Stripe
```

---

## Verificação — teste confirmado pelo backend

O teste foi feito directamente no servidor com o seguinte resultado:

| Passo | Acção | Resultado |
|---|---|---|
| 1 | `POST /cart/items` sem token | Token `bf499d61...` devolvido no header da resposta |
| 2 | `POST /orders/guest` com esse token | Pedido `STKZ-00010096` criado com sucesso |
| 3 | `GET /orders/guest/:id?token=` | Pedido devolvido com `guestPhone`, `totalAmount` e itens |

O backend está funcional. O erro `CART_EMPTY` é exclusivamente causado por token incorreto no frontend.

---

## Causas comuns do erro CART_EMPTY

| Causa | Como identificar | Como resolver |
|---|---|---|
| Frontend não leu o header da resposta ao adicionar item | `x-cart-token` não está guardado em nenhum lado | Ler o header `x-cart-token` da resposta de `POST /cart/items` |
| Token guardado em memória (variável local) e perdido ao navegar | Token existe durante a sessão mas perde-se ao trocar de página | Guardar em `localStorage` |
| Token enviado no body do request em vez do header | Backend não encontra o token | Mover para o header `x-cart-token` |
| Frontend gera o próprio UUID sem passar pelo backend | O token não corresponde a nenhum carrinho em Redis | Usar sempre o token devolvido pelo backend |
| Token diferente entre o carrinho e o checkout | Dois tokens distintos em uso | Garantir que é o mesmo valor em todo o fluxo |

---

## Resumo dos headers obrigatórios

| Endpoint | Header obrigatório |
|---|---|
| `POST /cart/items` (primeira vez) | Nenhum — o backend gera e devolve no response |
| `POST /cart/items` (seguintes) | `x-cart-token: <token guardado>` |
| `PATCH /cart/items/:variantId` | `x-cart-token: <token guardado>` |
| `DELETE /cart/items/:variantId` | `x-cart-token: <token guardado>` |
| `GET /cart` | `x-cart-token: <token guardado>` |
| `POST /orders/guest` | `x-cart-token: <token guardado>` |

---

## Após o pedido ser criado

Depois de `POST /orders/guest` responder com sucesso, o backend **limpa o carrinho automaticamente**. O frontend não precisa de apagar o token do `localStorage` imediatamente — mas deve limpá-lo após mostrar a página de sucesso, para que o próximo carrinho comece do zero.
