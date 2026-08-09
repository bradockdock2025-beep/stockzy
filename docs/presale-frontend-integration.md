# Pré-venda — Integração Frontend

## Visão Geral

A pré-venda permite que clientes comprem um produto antes de o stock estar disponível. O cliente paga o valor total no momento da compra (igual a uma compra normal). Quando o admin recebe o stock e activa o fulfillment, a encomenda entra em processamento e o cliente recebe um email de confirmação.

---

## 1. Campo `purchaseMode` no Produto

Nos endpoints de detalhe de produto (`GET /products/:slug` ou `GET /products/:id`), cada variante inclui o campo `purchaseMode`. Este campo é calculado pelo backend e é o único que o frontend deve usar para decidir o que mostrar ao utilizador.

### Valores possíveis

| Valor | Significado | O que mostrar |
|---|---|---|
| `normal` | Stock disponível, compra normal | Botão "Adicionar ao carrinho" |
| `sold_out` | Sem stock, sem pré-venda | Botão desactivado "Esgotado" |
| `presale` | Pré-venda activa, ainda há vagas | Badge "Pré-venda" + botão "Pré-comprar" |
| `presale_sold_out` | Pré-venda activa mas o limite de unidades foi atingido | Badge "Pré-venda" + botão desactivado "Esgotado" |

### Estrutura da variante no response

```json
{
  "id": "uuid",
  "sku": "SKU-001",
  "price": "89.00",
  "presaleEnabled": true,
  "presalePrice": "69.00",
  "presaleLimit": 50,
  "expectedAvailableAt": "2026-09-01T00:00:00.000Z",
  "purchaseMode": "presale",
  "availableQuantity": 0,
  "isAvailable": false
}
```

**Nota importante:** quando `purchaseMode` é `presale`, o campo `availableQuantity` será sempre `0` (é assim por design — não há stock físico ainda). O que interessa é o `purchaseMode`, não o `availableQuantity`.

### Campos de pré-venda relevantes para exibição

- **`presalePrice`** — preço especial de pré-venda. Se `null`, usa o `price` normal.
- **`expectedAvailableAt`** — data estimada de envio (ISO 8601). Pode ser `null` se o admin não definiu.
- **`presaleLimit`** — número máximo de unidades em pré-venda. Pode ser `null` (sem limite).

---

## 2. Página de Detalhe do Produto

### O que o frontend tem de implementar

Quando a página de detalhe de produto carrega, o frontend já chama a API e recebe os dados da variante. Dentro desse response, existe o campo `purchaseMode`. **O frontend tem de ler esse campo e renderizar os componentes visuais correspondentes.** O badge, o botão "Pré-comprar" e o bloco informativo não aparecem automaticamente — têm de ser construídos pelo frontend com base nesse valor.

Existe já uma variante activa com `purchaseMode: "presale"` (tamanho XL do produto Top Shirt 2026). Ao abrir essa página no site agora, o response da API já devolve `purchaseMode: "presale"` — mas como o UI ainda não foi implementado, a página continua a mostrar o comportamento anterior. **O que está em falta é o código de UI.**

---

### Como o frontend deve ler o campo

Quando o utilizador selecciona uma variante (tamanho), o frontend lê `variant.purchaseMode` e decide o que renderizar. Cada valor exige uma apresentação diferente:

---

### `purchaseMode === "normal"`
Fluxo padrão. Sem alterações.
- Botão "Adicionar ao carrinho" — visível e activo

---

### `purchaseMode === "sold_out"`
Sem alterações face ao comportamento actual.
- Botão "Esgotado" — visível e desactivado

---

### `purchaseMode === "presale"` — **REQUER IMPLEMENTAÇÃO DE UI**

Este é o estado que a variante XL tem agora. Ao seleccionar esse tamanho na página do produto, o frontend deve renderizar:

**1. Badge de pré-venda**
- Localização: junto ao título do produto ou junto ao preço
- Texto: "Pré-venda"
- Visual sugerido: fundo âmbar/laranja, texto branco, letra pequena maiúscula

**2. Preço**
- Se `variant.presalePrice` não for `null`: mostrar `presalePrice` como preço activo e `price` riscado por cima
- Se `variant.presalePrice` for `null`: mostrar `price` normalmente

**3. Bloco informativo** (abaixo do preço, antes do botão)
- Linha 1: *"Este produto está em pré-venda. O pagamento é processado agora e o envio será feito quando o stock estiver disponível."*
- Linha 2 (só se `variant.expectedAvailableAt` não for `null`): *"Envio estimado: [data formatada]"*
  - Formatar `expectedAvailableAt` conforme o locale do utilizador (ex: "Setembro de 2026")

**4. Botão de acção**
- Mostrar: botão "Pré-comprar" — activo
- Ocultar completamente: botão "Adicionar ao carrinho" — não pode estar visível nem desactivado, tem de desaparecer

**5. Comportamento do botão "Pré-comprar"**
- Ao clicar, adiciona o artigo ao carrinho usando `variant.id` (não o `product.id`)
- O resto do fluxo (carrinho → checkout → Stripe) é igual ao normal

---

### `purchaseMode === "presale_sold_out"` — **REQUER IMPLEMENTAÇÃO DE UI**

A pré-venda está activa mas o limite de unidades foi atingido.
- Badge visível: "Pré-venda — Esgotada"
- Botão "Esgotado" — visível e desactivado
- Botão "Adicionar ao carrinho" — oculto completamente

---

### Variante de teste disponível agora

| Campo | Valor |
|---|---|
| Produto | Top Shirt 2026 — Brown / XL |
| `variantId` | `101df4dc-0bac-4b91-acc4-83f94611f948` |
| `purchaseMode` | `presale` |
| `presalePrice` | `119.99` |
| `price` | `119.99` |
| `expectedAvailableAt` | `2026-09-01T00:00:00.000Z` |

Ao seleccionar o tamanho XL neste produto, o response da API já devolve `purchaseMode: "presale"`. Se o badge e o botão "Pré-comprar" não aparecerem, significa que os componentes visuais descritos acima ainda não foram implementados.

---

## 3. Carrinho

### IMPORTANTE — variantId vs productId

Ao adicionar um artigo ao carrinho, o frontend deve enviar o **`id` da variante**, não o `id` do produto. São UUIDs diferentes e esta é a causa de erro mais comum.

Exemplo com o response do produto:

```json
{
  "id": "4ad44a53-949c-482f-8935-fca1d1f9037b",      ← productId  — NÃO usar
  "variants": [
    {
      "id": "101df4dc-0bac-4b91-acc4-83f94611f948",   ← variantId  — usar este
      "purchaseMode": "presale",
      ...
    }
  ]
}
```

O request de adicionar ao carrinho deve ser:
```json
POST /cart/items
{
  "variantId": "101df4dc-0bac-4b91-acc4-83f94611f948",
  "quantity": 1
}
```

Se for enviado o `productId` em vez do `variantId`, o checkout falha com `ITEMS_UNAVAILABLE`.

---

### Regra de carrinho misto

O backend **rejeita** um carrinho que misture artigos de pré-venda com artigos de compra normal. O frontend deve impedir esta situação antes de enviar o pedido.

**Comportamento esperado:**
- Se o carrinho já tiver artigos normais e o utilizador clicar "Pré-comprar", mostrar um aviso: *"Não é possível misturar artigos de pré-venda com artigos normais. Faça checkout separado."*
- Se o carrinho já tiver artigos de pré-venda e o utilizador tentar adicionar um artigo normal, bloquear com o mesmo aviso.

**Erro que o backend retorna se a mistura acontecer na mesma de qualquer forma:**
```json
{
  "statusCode": 400,
  "code": "MIXED_CART_NOT_ALLOWED",
  "message": "Cannot mix presale items with regular items. Please checkout separately."
}
```

### Exibição dos artigos de pré-venda no carrinho

- Exibir badge "Pré-venda" ao lado do nome do produto
- Exibir o preço de pré-venda (que pode ser diferente do preço normal)
- Exibir nota informativa: *"Estes artigos são de pré-venda. O pagamento é processado agora e o envio será feito quando o stock estiver disponível."*

---

## 4. Checkout e Pagamento

O fluxo de checkout e pagamento via Stripe é **exactamente igual** a uma compra normal. **Não é necessária nenhuma alteração no código de frontend do checkout.**

### O que não muda

- O frontend chama `POST /customers/orders` da mesma forma que numa compra normal
- O backend devolve o `clientSecret` do Stripe — igual ao normal
- O frontend usa `stripe.confirmPayment({ clientSecret })` — **exactamente o mesmo código**
- O Stripe processa e captura o pagamento a 100% imediatamente — sem autorização prévia nem captura diferida
- A página de sucesso após pagamento é a mesma

### O que muda apenas no backend (invisível para o frontend)

- A encomenda é criada com `status: "presale"` em vez de `status: "pending"`
- O email enviado ao cliente é o de "Pré-venda confirmada" em vez do email de encomenda normal

### Como o frontend pode diferenciar no ecrã de sucesso (opcional)

Após o pagamento, se o frontend quiser mostrar uma mensagem diferente para pré-vendas, basta verificar o `status` da encomenda no response de `POST /customers/orders`:

```
status === "presale"  → mostrar "Pré-venda confirmada! O envio será feito quando o stock chegar."
status === "pending"  → mostrar "Encomenda confirmada!" (fluxo normal)
```

Esta adaptação é **opcional** — o fluxo funciona sem ela.

### Erro de limite atingido

Se o limite de pré-venda for atingido entre o momento em que o utilizador viu a página e o momento em que tenta pagar:

```json
{
  "statusCode": 400,
  "code": "PRESALE_LIMIT_EXCEEDED",
  "message": "Presale limit exceeded",
  "details": {
    "limit": 50,
    "available": 0
  }
}
```

Neste caso, redirigir o utilizador de volta ao produto com a mensagem de erro.

---

## 5. Estado da Encomenda

Após uma compra de pré-venda, a encomenda fica com status `presale` em vez de `pending`.

### Ciclo de vida de uma encomenda de pré-venda

```
presale → processing → shipped → delivered
    ↓
 cancelled
```

- **`presale`** — pago, a aguardar stock
- **`processing`** — admin activou o fulfillment, stock reservado, a ser preparado para envio
- A partir de `processing`, o fluxo é idêntico a uma encomenda normal

### Exibição nas páginas de conta do cliente

| Status | Label sugerido | Descrição para o cliente |
|---|---|---|
| `presale` | "Pré-venda confirmada" | "O seu pagamento foi confirmado. O artigo será enviado quando o stock estiver disponível." |
| `processing` | "Em preparação" | (igual ao fluxo normal) |

### Cancelamento de encomendas em pré-venda

Uma encomenda com status `presale` pode ser cancelada (pelo cliente ou pelo admin). O reembolso deve ser processado manualmente via Stripe dashboard — o backend não processa reembolsos automáticos.

---

## 6. Notificações por Email (recebidas pelo cliente)

| Evento | Quando é enviado |
|---|---|
| **Pré-venda confirmada** | Imediatamente após o pagamento, quando o order é criado com status `presale` |
| **Pré-venda cumprida** | Quando o admin activa o batch fulfillment — o status muda para `processing` |
| **Pré-venda cancelada** | Quando a encomenda em `presale` é cancelada |

O email de confirmação inclui a data estimada de envio (`expectedAvailableAt`) se estiver definida.

---

## 7. Endpoints de Admin

Estes endpoints são usados pelo painel de administração, não pelo cliente final.

### Activar / desactivar pré-venda numa variante

```
PATCH /admin/products/variants/:variantId/presale
```

**Body:**
```json
{
  "presaleEnabled": true,
  "presalePrice": 69.00,
  "presaleLimit": 50,
  "expectedAvailableAt": "2026-09-01T00:00:00.000Z"
}
```

- `presaleEnabled` — obrigatório (boolean)
- `presalePrice` — opcional. Se omitido, usa o preço normal da variante.
- `presaleLimit` — opcional. Se omitido, não há limite de unidades.
- `expectedAvailableAt` — opcional. Data ISO 8601.

**Regra de negócio:** só é possível activar pré-venda quando o `stockQuantity` da variante for `0`. Se houver stock disponível, o backend retorna:
```json
{
  "statusCode": 400,
  "message": "Cannot enable presale while variant has stock available. Set stock to 0 first."
}
```

Para desactivar pré-venda, enviar `presaleEnabled: false`. Os campos `presalePrice`, `presaleLimit`, `expectedAvailableAt` são limpos automaticamente.

---

### Activar fulfillment em batch (quando o stock chega)

```
POST /admin/orders/presale/activate
```

**Body:**
```json
{
  "variantId": "uuid-da-variante"
}
```

**O que este endpoint faz:**
1. Encontra todas as encomendas com status `presale` que contêm esta variante
2. Verifica se o stock actual é suficiente para cobrir todas as encomendas
3. Move todas as encomendas para `processing`
4. Decrementa o stock pela quantidade total vendida
5. Desactiva a pré-venda na variante (`presaleEnabled: false`)
6. Envia email "Pré-venda cumprida" para cada cliente

**Response de sucesso:**
```json
{
  "activated": 12
}
```
`activated` é o número de encomendas movidas para `processing`.

**Erro se o stock for insuficiente:**
```json
{
  "statusCode": 400,
  "message": "Insufficient stock to fulfill all presale orders. Available: 30, required: 45"
}
```
Neste caso, nenhuma encomenda é alterada — a operação é atómica.

---

## 8. Fluxo Completo — Resumo Visual

```
[Admin] Stock = 0
    ↓
[Admin] PATCH /admin/products/variants/:id/presale
        { presaleEnabled: true, presalePrice: 69, ... }
    ↓
[Produto] purchaseMode = "presale"
    ↓
[Cliente] Vê badge "Pré-venda" + botão "Pré-comprar" na página do produto
    ↓
[Cliente] Clica "Pré-comprar" → adiciona ao carrinho → checkout → paga via Stripe
    ↓
[Backend] Cria order com status = "presale"
    ↓
[Cliente] Recebe email "Pré-venda confirmada"
    ↓
    ... (semanas ou meses depois) ...
    ↓
[Admin] Stock chega ao armazém → actualiza stockQuantity no sistema
    ↓
[Admin] POST /admin/orders/presale/activate { variantId: "..." }
    ↓
[Backend] Todas as orders presale → processing | Stock decrementado | presaleEnabled = false
    ↓
[Cliente] Recebe email "Pré-venda cumprida — o seu pedido está em preparação"
    ↓
[Produto] purchaseMode = "normal" (pré-venda desactivada)
```

---

## 9. Erros que o Frontend deve tratar

| Código | Situação | Acção recomendada |
|---|---|---|
| `MIXED_CART_NOT_ALLOWED` | Mistura de artigos normais e pré-venda | Mostrar aviso e bloquear adição |
| `PRESALE_LIMIT_EXCEEDED` | Limite de pré-venda atingido durante checkout | Redirigir para o produto com mensagem de erro |
| `INSUFFICIENT_STOCK` | Stock insuficiente (artigo normal) | Mensagem de stock insuficiente |
| `ITEMS_UNAVAILABLE` | Variante não encontrada ou removida | Remover do carrinho e avisar |
