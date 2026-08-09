# Guest Checkout — Relatório de Bug: CART_EMPTY em Testes Repetidos

**Data:** Junho 2026  
**Componente afectado:** `components/sections/GuestCheckoutModal/GuestCheckoutModal.tsx`  
**Endpoint afectado:** `POST /api-proxy/orders/guest`  
**Severidade:** Alta — impede o checkout de funcionar de forma consistente  

---

## 1. Descrição do Problema

O endpoint `POST /orders/guest` respondia `CART_EMPTY` a partir do segundo teste em diante, mesmo com itens válidos no carrinho local.

```json
{
  "code": "CART_EMPTY",
  "message": "Cart is empty"
}
```

**Padrão observado:**

| Teste | Resultado |
|---|---|
| 1.º (sessão limpa) | ✓ Sucesso — order criada |
| 2.º em diante | ✗ `CART_EMPTY` — mesmo payload, mesmos itens |

O payload enviado estava sempre correcto:

```json
{
  "phone": "+244939114018",
  "country": "AO",
  "locale": "pt"
}
```

O problema estava no **header `x-cart-token`** enviado em `POST /orders/guest` — não no body.

---

## 2. Arquitectura Relevante

### 2.1 Como o token é gerado e propagado

O backend gera o `x-cart-token` na primeira chamada a `POST /cart/items`. A partir daí, cada resposta do backend inclui o token — tanto no **header** (`x-cart-token`) como no **body** (`{ token: "..." }`).

O frontend usa um proxy Next.js definido em `next.config.ts`:

```
Browser → /api-proxy/cart/items → Next.js rewrite → API real
```

O `cartService.ts` tem duas formas de capturar o token da resposta:

```typescript
// Mecanismo 1 — header da resposta (via persistToken)
function persistToken(response: Response, fallback: string | null): string | null {
  const fromHeader = response.headers.get("x-cart-token");
  const token = fromHeader ?? fallback;
  if (token) localStorage.setItem("doja_cart_token", token);
  return token;
}

// Mecanismo 2 — body da resposta (via return value de addCartItem)
export async function addCartItem(variantId: string, quantity = 1): Promise<ApiCart> {
  // ...
  persistToken(res, cartToken);  // Mecanismo 1
  if (!res.ok) return handleError(res);
  return res.json();             // Mecanismo 2: { token, items, updatedAt }
}
```

### 2.2 Como os itens são adicionados ao carrinho localmente

Em `CartContext.tsx`, quando o utilizador adiciona um item:

```typescript
// CartContext.addItem — fire-and-forget
addCartItem(item.variantId, 1)
  .then((cart) => {
    if (cart.token) setCartToken(cart.token);  // usa Mecanismo 2 (body)
  })
  .catch(() => {});
```

O `CartContext` usa o `cart.token` do body para guardar o token no React state (`cartToken`) e em `localStorage`.

---

## 3. Causa Raiz

### 3.1 O bug no `syncCartToBackend` (versão anterior)

A função `syncCartToBackend` foi implementada para garantir que o backend tinha um carrinho fresco antes do checkout. Porém, continha dois erros críticos:

**Erro 1 — Return value de `addCartItem` ignorado:**

```typescript
// ❌ Versão anterior — return value ignorado
for (const item of syncable) {
  try {
    await addCartItem(item.variantId!, item.quantity);  // cart.token desperdiçado
  } catch {
    // non-fatal
  }
}
return getStoredCartToken() ?? existingToken;  // depende do Mecanismo 1 (header)
```

A função dependia exclusivamente do **Mecanismo 1** (`persistToken` via header) para guardar o token novo em `localStorage`. O `cart.token` do body (Mecanismo 2) era completamente ignorado.

**Erro 2 — Fallback para token stale:**

```typescript
return getStoredCartToken() ?? existingToken;
```

Se `getStoredCartToken()` retornasse `null` (porque o Mecanismo 1 falhou), a função fazia fallback para `existingToken` — que era o `cartToken` do React state, ou seja, o **token da sessão anterior**.

### 3.2 Por que o Mecanismo 1 (header) falha através do proxy

O proxy Next.js (`/api-proxy/*` → API real) é uma reescrita de URL server-side. Em determinadas condições, o header `x-cart-token` da resposta do backend **não é propagado** de forma fiável até ao browser:

- O `response.headers.get("x-cart-token")` no browser pode retornar `null`
- O `localStorage` não é actualizado por `persistToken`
- `getStoredCartToken()` retorna `null`

### 3.3 Diagrama do bug por teste

**1.º Teste (funciona por acidente):**

```
Utilizador adiciona item → CartContext.addItem → addCartItem → cart.token = T0
→ setCartToken(T0) → cartToken no React state = T0, localStorage = T0

Utilizador abre modal → syncCartToBackend(items, existingToken=T0)
  → remove localStorage
  → addCartItem → backend cria carrinho T1 → persistToken não guarda (header perdido)
  → getStoredCartToken() = null
  → fallback: existingToken = T0  ← token original ainda válido no backend
  
createGuestOrder(T0) → backend encontra carrinho T0 com itens → ✓ ORDER CRIADA
→ backend consome/limpa o carrinho T0
```

**2.º Teste (falha):**

```
Utilizador abre modal novamente → syncCartToBackend(items, existingToken=T0)
  → remove localStorage
  → addCartItem → backend cria carrinho T2 → persistToken não guarda (header perdido)
  → getStoredCartToken() = null
  → fallback: existingToken = T0  ← cartToken React state NUNCA foi actualizado
  
createGuestOrder(T0) → backend procura carrinho T0 → VAZIO (consumido na 1.ª order)
→ ✗ CART_EMPTY
```

**Resumo da diferença entre os dois testes:**

| | 1.º Teste | 2.º Teste |
|---|---|---|
| `existingToken` (React state) | T0 — válido | T0 — consumido pelo backend |
| `getStoredCartToken()` | null (header perdido) | null (header perdido) |
| Token enviado em `createGuestOrder` | T0 ✓ | T0 ✗ |
| Resultado | Sucesso | CART_EMPTY |

O React state `cartToken` **nunca é actualizado** por `syncCartToBackend` — mantém sempre o valor T0 da sessão de adição de itens, independentemente de quantas orders foram criadas.

---

## 4. Solução Implementada

### 4.1 Princípio da correcção

Usar o **Mecanismo 2** (body da resposta `cart.token`) em vez do Mecanismo 1 (header via proxy), e eliminar qualquer fallback para token stale.

### 4.2 `syncCartToBackend` — versão corrigida

```typescript
async function syncCartToBackend(items: CartItem[]): Promise<string | null> {
  const syncable = items.filter((i) => i.variantId);
  if (syncable.length === 0) return null;

  // Limpa o token stale para forçar criação de carrinho novo no backend
  if (typeof window !== "undefined") {
    localStorage.removeItem("doja_cart_token");
  }

  let freshToken: string | null = null;

  for (const item of syncable) {
    try {
      const cart = await addCartItem(item.variantId!, item.quantity);
      
      // ✅ Usa cart.token do body — sempre disponível, não depende do proxy
      if (cart.token) {
        freshToken = cart.token;
        if (typeof window !== "undefined") {
          localStorage.setItem("doja_cart_token", cart.token);
        }
      }
    } catch {
      // non-fatal — continua com os itens seguintes
    }
  }

  // ✅ Sem fallback para token stale — se o sync falhou, retorna null
  return freshToken;
}
```

### 4.3 Alterações em `handleContactSubmit`

```typescript
// ❌ Anterior — passava cartToken (potencialmente stale) como fallback
const freshToken = await syncCartToBackend(items, cartToken);

// ✅ Actual — sem fallback stale
const freshToken = await syncCartToBackend(items);
```

### 4.4 Limpeza de imports

`cartToken` foi removido do destructuring de `useCart()` pois deixou de ser necessário:

```typescript
// ❌ Anterior
const { cartToken, totalPrice, items } = useCart();

// ✅ Actual
const { totalPrice, items } = useCart();
```

---

## 5. Fluxo Correcto Após o Fix

```
Utilizador clica "Continuar" no Modal 1
        ↓
syncCartToBackend(items)
  → remove doja_cart_token de localStorage
  → POST /cart/items (item 1, qty N)
      → backend cria carrinho novo → devolve { token: "T_novo", items: [...] }
      → freshToken = "T_novo"
      → localStorage.setItem("doja_cart_token", "T_novo")
  → POST /cart/items (item 2, se existir)
      → addCartItem lê localStorage → envia x-cart-token: T_novo
      → backend adiciona ao mesmo carrinho → devolve { token: "T_novo", ... }
      → freshToken = "T_novo" (confirmado)
  → retorna "T_novo"
        ↓
createGuestOrder("T_novo", { phone, country, locale })
  → POST /orders/guest com x-cart-token: T_novo
  → backend encontra carrinho T_novo com itens ✓
  → responde: { orderId, guestToken, clientSecret, publishableKey }
        ↓
Modal avança para Passo 2 — Stripe Payment Element
```

---

## 6. Notas para o Backend

### 6.1 Confirmação solicitada

Seria útil o backend confirmar se o `x-cart-token` é devolvido tanto no **header** como no **body** da resposta de `POST /cart/items`. A solução actual assume que `body.token` existe sempre — se em alguma situação o body não incluir o token, o `freshToken` ficará `null` e o utilizador verá o erro de carrinho vazio no frontend.

### 6.2 Comportamento do proxy Next.js

O frontend comunica com o backend exclusivamente via proxy Next.js (`/api-proxy/*`). Headers de resposta personalizados (como `x-cart-token`) podem não ser propagados de forma fiável em todas as situações. A solução implementada evita esta dependência ao ler o token do body.

### 6.3 Vida útil do carrinho

Após `POST /orders/guest` ser chamado com sucesso, o backend limpa o carrinho associado ao token. O frontend cria sempre um carrinho novo no início de cada tentativa de checkout (não reutiliza tokens de orders anteriores).

---

## 7. Ficheiros Alterados

| Ficheiro | Tipo de alteração |
|---|---|
| `components/sections/GuestCheckoutModal/GuestCheckoutModal.tsx` | Bug fix em `syncCartToBackend` e `handleContactSubmit` |

Nenhum outro ficheiro foi alterado. O `cartService.ts` e o `CartContext.tsx` não foram modificados.
