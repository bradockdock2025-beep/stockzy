# Backend — Fluxo Completo e Regras de Negócio

Documento de referência para replicar o mesmo fluxo de regras de negócio num novo projeto.

---

## Índice

1. [Autenticação — Admin](#1-autenticação--admin)
2. [Autenticação — Cliente](#2-autenticação--cliente)
3. [Catálogo de Produtos](#3-catálogo-de-produtos)
4. [Carrinho](#4-carrinho)
5. [Checkout](#5-checkout)
6. [Pagamento](#6-pagamento)
7. [Ciclo de Vida do Pedido](#7-ciclo-de-vida-do-pedido)
8. [Regras de Inventário](#8-regras-de-inventário)
9. [Conta do Cliente](#9-conta-do-cliente)
10. [Promoções e Cupões](#10-promoções-e-cupões)
11. [Envio / Shipping](#11-envio--shipping)
12. [Notificações por Email](#12-notificações-por-email)
13. [Auditoria](#13-auditoria)

---

## 1. Autenticação — Admin

**Tabela:** `users` | **Estratégia:** JWT + Refresh Token (rotação)

### Login
- `POST /auth/login`
- Email normalizado (case-insensitive)
- Senha verificada com `bcrypt`
- JWT assinado com `{ sub, role, email }`, TTL = `JWT_EXPIRES_IN` (default `1d`)
- Refresh token: 64 bytes aleatórios, hash SHA-256, armazenado em `RefreshToken` com `expiresAt`

### Refresh
- `POST /auth/refresh`
- Token recebido → hash SHA-256 → lookup no DB → verificar `revokedAt` e `expiresAt`
- Rotação imediata: token antigo revogado, novo par emitido

### Logout
- `POST /auth/logout` → `revokedAt = now()` no refresh token

### Troca de Senha
- Senha atual verificada → nova senha hasheada → todos os refresh tokens do user revogados na mesma transação

### Guard
- `JwtAuthGuard` aplicado globalmente
- Lê `Authorization: Bearer <token>`
- Rotas públicas decoradas com `@Public()` ignoram o guard

### Rate Limiting (Login)
- 5 tentativas por janela de 60 segundos por `ip|email`
- Após limite: bloqueio com backoff exponencial
  - `blockMs = baseBlockMs × multiplier^(penaltyLevel - 1)`, máximo `maxBlockMs` (1h)
- Estado em Redis (fallback: Map em memória)
- Todos os eventos de bloqueio persistidos em `LoginRateLimitAudit`

---

## 2. Autenticação — Cliente

**Tabela:** `customers` | **Estratégia:** Supabase Auth (JWT gerido pelo Supabase)

### Registo
- `POST /customers/register`
- Email normalizado
- Se cliente ativo existir → rejeitar
- Se cliente inativo com `authUserId` → reutilizar (reset de senha via admin API)
- Criar user no Supabase Auth com `email_confirm: false`
- Upsert em `Customer`
- Enviar OTP de verificação via `signInWithOtp({ shouldCreateUser: false })`
- Resposta: `{ requiresEmailVerification: true, email }`

### Login
- `POST /customers/login`
- Supabase `signInWithPassword`
- Se erro contém `email_not_confirmed` → `EMAIL_NOT_VERIFIED`
- Sincroniza `emailVerifiedAt` / `phoneVerifiedAt` do Supabase para `Customer`
- Retorna sessão Supabase completa (`access_token`, `refresh_token`, `expires_in`)

### Verificação OTP
- `POST /customers/verify/email/otp`
- Supabase `verifyOtp({ type: 'email' })`
- Na **primeira** verificação (`emailVerifiedAt` era null) → dispara email de boas-vindas
- Cooldown de reenvio de OTP: 60 segundos via Redis key `otp:cooldown:{email}`

### Reset de Senha
- Pedido → sempre HTTP 200 (anti-enumeração de emails)
- Token de 32 bytes, hash SHA-256, armazenado em Redis com TTL de 30 minutos
- Token anterior invalidado se existir
- Confirmação → token eliminado antes de actualizar (single-use, safe contra race conditions)
- Após reset: todas as sessões Supabase terminadas globalmente

### Guard do Cliente
- `CustomerAuthGuard` valida Bearer token via `admin.auth.getUser(token)`
- Hash do token cacheado em Redis por 4 minutos
- Popula `request.customerAuth` com `{ authUserId, email, accessToken, emailVerifiedAt }`

---

## 3. Catálogo de Produtos

> Reescrito — o modelo antigo (`CategoryAttribute`/`AttributeOption`/`VariantAttributeValue`,
> filtros `cor`/`tamanho`/`attributes`) foi removido e substituído pelo sistema de
> Facet/Brand descrito abaixo. Ver `docs/frontend-integration/03-catalogo-filtros-busca.md`
> e `docs/frontend-integration/20-comportamento-categorias.md` pra a documentação
> orientada a consumidor da API (esta seção é a visão de implementação/backend).

### Modelo de Dados
```
Product → ProductVariant → Inventory (1:1)
       → ProductFacetValue (N)      [facetas com scope=product: gender, garment_type, bag_type...]
ProductVariant → VariantFacetValue (N)   [facetas com scope=variant: color, size_*, shoe_height...]
Category → Category (self, parentId)     [hierarquia — sempre 2 níveis reais: raiz → subcategoria]
Brand (entidade própria, não é faceta)
Facet → FacetValue (N)
```

- `Product.status`: `active | archived | draft`
- `Product`: `featured`, `featuredUntil`, `featuredOrder`, `displayOrder`, `categoryId`, `brandId?`
- `ProductVariant`: `price`, `compareAtPrice`, `sku`, `isActive`, `presaleEnabled`, `presalePrice`, `presaleLimit`, `expectedAvailableAt`
- `Category`: `parentId` (auto-relação), `familyTag?` (agrupa categorias pra visibilidade de faceta — hoje `vestuario` em Apparel/filhas, `calcado` em Shoes+Sneakers/filhas; a maioria não tem)
- `Facet`: `key` (estável, usado na query string), `name` (rótulo de exibição), `inputType` (`link`/`checkbox`/`swatch`/`slider`/`chip` — dica de UI), `scope` (`product` ou `variant` — decide se filtra via `ProductFacetValue` ou `VariantFacetValue`), `visibility` (ver abaixo)

### Regras de visibilidade de faceta (`isFacetVisible`, `products.service.ts:439`)

| `visibility` | Regra | Uso real hoje |
|---|---|---|
| `always` | Sempre elegível (ainda sujeita à regra "some se zerar", ver adiante) | `gender`... na prática quase tudo cai aqui, incluindo `bag_type` |
| `category_family` | Só elegível se `Category.familyTag` da categoria ativa bater com `Facet.visibilityValue` | `garment_type` (`vestuario`), `shoe_height` (`calcado`) |
| `gender_fixed_absent` | Só elegível se a query **não** tiver filtro pra essa própria faceta ainda | usado pra facetas fixas de gênero em contexto já resolvido |
| `gender_equals` | Só elegível se o filtro `gender` ativo incluir `Facet.visibilityValue` | facetas específicas de um gênero (ex.: só aparece se `gender=kids`) |

Independente da regra acima, **toda faceta some da resposta se, depois de calculada, todos os seus valores tiverem contagem zero** — não é uma regra de `visibility`, é aplicada depois, sobre o resultado.

### Listagem e Filtros (`GET /products`, `GET /catalog/filters`)

Apenas produtos `status = active` são retornados. Filtros suportados (`QueryProductDto`):

| Parâmetro | Comportamento |
|---|---|
| `categoryId` | Resolve a categoria + todos os descendentes via CTE recursiva (`getCategoryAndDescendantIds`, `products.service.ts:572`) — hoje a árvore só tem 2 níveis reais, mas o código não assume isso, suportaria mais |
| `search` | Modo básico (`ILIKE`) ou FTS (`websearch_to_tsquery` em `search_vector`), controlado por `PRODUCT_SEARCH_MODE` |
| `sort` | `featured`, `newest`, `relevance`, `price_asc`, `price_desc` |
| `featured` | Boolean (string `"true"`/`"false"`) |
| `minPrice` / `maxPrice` | Filtro no preço da variante |
| `inStock` | `stockQuantity > reservedQuantity` |
| `belowRetail` | `price < compareAtPrice` |
| `brand` | `Brand.slug`, um ou vários — **não é faceta**, é relação própria (`Product.brandId`) |
| `facets` | Genérico, formato `key:val1|val2;key2:val3` — `key` referencia `Facet.key`. AND entre facetas diferentes, OR entre valores da mesma faceta |

**Montagem do filtro (`buildFacetFragments`, `products.service.ts:492`):** cada faceta ativa (incluindo `brand`) vira um fragmento `Prisma.ProductVariantWhereInput` independente — via `ProductFacetValue` se `Facet.scope = 'product'`, via `VariantFacetValue` se `scope = 'variant'`. `GET /products` combina **todos** os fragmentos com `AND`. `GET /catalog/filters` combina, pra cada faceta sendo contada, **todos os fragmentos exceto o dela própria** (auto-exclusão) — é isso que permite trocar de valor sem a lista "zerar" primeiro.

**Categoria dentro do filtro (`getFilters`):** o campo `categories` da resposta é sempre **os filhos diretos** da categoria ativa (ou as raízes, se nenhuma `categoryId`) — nunca a árvore inteira. Preço (`priceMin`/`priceMax`) é a única coisa calculada sobre o filtro **completo**, sem nenhuma exclusão.

### Disponibilidade por Variante
Cada variante recebe anotação automática:
```
availableQuantity = max(0, stockQuantity - reservedQuantity)
isAvailable: boolean
purchaseMode: "normal" | "presale" | "sold_out" | "presale_sold_out"
```

### Cache
- Respostas de lista e detalhe cacheadas em Redis (`cache:products:*`)
- TTL: `PRODUCTS_CACHE_TTL_SECONDS` (default 60s)
- Invalidado em: create/update/archive de produto, alteração de opções de atributo

### Secções da Homepage
- **Destaques**: `featured = true AND featuredUntil >= now`, ordenado por `featuredOrder`; preenche com não-destaque se curto
- **Novidades**: criados nos últimos `NEW_ARRIVALS_WINDOW_DAYS` dias (default 30)
- **Mais vendidos**: tabela `ProductRanking` (`unitsSold7d`, `unitsSold30d`, `unitsSoldAll`)
- **Melhores preços**: produtos com desconto ≥ `minDiscount`% calculado a partir de `compareAtPrice` ou promoção ativa
- **Ofertas**: produtos alvo de promoções ativas (tipo `product` ou `category`), incluindo descendentes

### Geração de SKU
Formato: `{DEPT_CODE}-{CAT_CODE}-{YEAR}-{SEQ:6}`
- Sequência por escopo armazenada em tabela `sku_sequences` com `ON CONFLICT DO UPDATE`

### Historial de Preços
Todo o create de variante e toda a alteração de `price` ou `compareAtPrice` grava um registo em `PriceHistory`.

### Pré-venda (Presale)
- `presaleEnabled` só pode ser activado quando `availableQuantity = 0`
- Preço unitário em presale: `presalePrice` (se definido), senão `price` normal
- `presaleLimit` limita o total de pedidos presale para essa variante
- Não faz reserva de stock — apenas conta contra `presaleLimit`

---

## 4. Carrinho

**Armazenamento: Redis puro** (sem tabela em DB)

- Chave: `cart:{uuid}`, valor: `{ items: [{ variantId, quantity }], updatedAt }`
- TTL: `CART_TTL_SECONDS` (default 7 dias), renovado a cada leitura
- Token identificado pelo header `x-cart-token`
- JSON corrompido → reset silencioso para carrinho vazio

### Operações
| Endpoint | Comportamento |
|---|---|
| `GET /cart` | Carrega ou cria carrinho |
| `POST /cart/items` | Se variantId já existe → incrementa; senão adiciona |
| `PATCH /cart/items/:variantId` | Actualiza quantidade; quantity=0 remove |
| `DELETE /cart/items/:variantId` | Remove item |
| `DELETE /cart` | Esvazia carrinho |

**Não existe merge automático** de carrinho guest → autenticado. O cliente passa sempre o mesmo `cartToken` ao fazer checkout.

---

## 5. Checkout

### Checkout Autenticado (`POST /orders/customer`)

#### Passo 1 — Idempotência
- Header opcional `Idempotency-Key`
- Redis key: `idempotency:orders:{authUserId}:{key}`
- Estado `pending` (TTL 10min) durante processamento
- Estado `{orderId}` (TTL 24h) após sucesso
- Retry de operação já concluída → retorna resultado existente
- Pedido duplicado em flight → `ConflictException`

#### Passo 2 — Gate de verificação de email
- `emailVerifiedAt` deve estar preenchido, senão `EMAIL_VERIFICATION_REQUIRED`

#### Passo 3 — Quote (`buildCartQuote`)
1. Carrega carrinho do Redis; falha se vazio
2. Carrega variantes (`isActive = true AND product.status = active`); item não encontrado → `ITEMS_UNAVAILABLE`
3. Carrinho misto (presale + não-presale) → `MIXED_CART_NOT_ALLOWED`
4. Para itens normais: verifica `stockQuantity - reservedQuantity >= qty` → `INSUFFICIENT_STOCK`
5. Preço unitário: `presalePrice` (se aplicável) ou `price`
6. Cálculo de shipping (ver secção 11)
7. Resolução de promoção (ver secção 10)
8. `totalAmount = subtotal + shippingAmount - discountAmount` (mínimo 0)

#### Passo 4 — Morada
Prioridade: `dto.addressId` (verificar ownership) > `dto.shippingAddress` inline > erro `SHIPPING_ADDRESS_REQUIRED`

#### Passo 5 — Transação DB
1. `SELECT ... FOR UPDATE` em cada inventory (evita oversell)
2. Recheck de stock disponível
3. `UPDATE inventory SET reserved_quantity = reserved_quantity + qty`
4. Para presale: soma qty existente de presale orders, verifica contra `presaleLimit` → `PRESALE_LIMIT_REACHED`
5. Cria `Order` com status `presale` ou `pending`
6. Número do pedido: sequência PostgreSQL `orders_display_seq` → formato `STKZ-{8 dígitos}`
7. Cria `OrderItem` records
8. Regista `PromotionUsage` se promoção aplicada
9. Se pagamento não é Stripe: cria `Payment` com `method=cod, status=awaiting_confirmation`

#### Passo 6 — Pós-transação
- Enfileira job `order.created` no BullMQ
- Enfileira job `order.reservation_timeout` com delay = TTL do código de confirmação
- Limpa carrinho no Redis
- Guarda orderId na cache de idempotência

### Checkout Guest (`POST /orders/guest`)
- Aceita `cartToken`, `phone`, `country`, `locale`
- Mesmas verificações de stock/presale
- Sem promoção aplicada
- Sempre cria Stripe PaymentIntent imediatamente
- `customerId = null`, guarda `guestPhone` e `guestToken` (UUID para lookup)

### Quote sem criar pedido
`POST /orders/customer/quote` — executa `buildCartQuote` sem criar nada; retorna breakdown completo incluindo promoção.

---

## 6. Pagamento

### Método COD (Confirmação Manual)

1. Na criação do pedido: código de 6 dígitos gerado (`randomInt(0, 1_000_000)` zero-padded)
2. Código HMAC-SHA256 com `PAYMENT_CONFIRMATION_SECRET`, armazenado como `confirmationCodeHash`
3. TTL: `PAYMENT_CONFIRMATION_TTL_HOURS` (default 24h)
4. Status inicial: `awaiting_confirmation`

**Confirmação** (`POST /payments/:orderId/confirm { code }`):
- Comparação timing-safe (`timingSafeEqual` com padding)
- `confirmationAttempts` incrementado a cada tentativa errada
- Máximo de tentativas: `PAYMENT_CONFIRMATION_MAX_ATTEMPTS` (default 5) → status `failed`
- Código expirado → status `expired`
- Sucesso:
  - Payment `status → paid`, `confirmedAt = now()`
  - Order `status → paid`
  - `stock_quantity -= qty` e `reserved_quantity -= qty` por item
  - Idempotência igual ao checkout

### Método Stripe

1. `POST /payments/:orderId/stripe` cria `PaymentIntent` no Stripe
2. Montante: maioria das moedas × 100; moedas zero-decimal (XOF, XAF, JPY…) × 1
3. Moeda default: `PAYMENT_CURRENCY` ou `DEFAULT_CURRENCY`, fallback `AOA`
4. Metadata: `{ orderId, orderNumber }`
5. Retorna `clientSecret` e `publishableKey` ao frontend

**Webhook** (`POST /payments/stripe/webhook`):
- Valida assinatura via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Responde sempre HTTP 200 (mesmo em erro interno) para evitar retries do Stripe
- `payment_intent.succeeded`:
  - Marca payment `paid`
  - Order `status → paid` (não-presale)
  - Deduz `stock_quantity` e `reserved_quantity` por item
  - Dispara `order.created` e `payment.confirmed` (não-presale, não-guest)
- `payment_intent.payment_failed`:
  - Payment `status → failed`
  - Dispara `payment.failed`

---

## 7. Ciclo de Vida do Pedido

### Diagrama de Estados
```
pending  ──→  processing ──→  shipped ──→  delivered ──→  refunded
   │               ↑              │
   │    paid ──────┘          cancelled
   └──→ paid
presale ──→  processing ──→ ...
   └──────────────────────→  cancelled
```

### Transições Permitidas
| De | Para |
|---|---|
| `pending` | `processing`, `cancelled` |
| `paid` | `processing`, `shipped`, `cancelled` |
| `presale` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `cancelled` |
| `delivered` | `refunded` |

Qualquer outra transição → `INVALID_STATUS_TRANSITION`

### Cancelamento
- Cancelável: `pending`, `paid`, `presale`, `processing`
- Não cancelável: `shipped`, `delivered`, `refunded`, `cancelled`
- Ao cancelar (não-presale): `reserved_quantity -= qty` por item
- Todos os pagamentos não pagos → `cancelled` ou `expired`
- Idempotência via Redis

### Timeout de Reserva
- Job BullMQ `order.reservation_timeout` enfileirado após criação do pedido
- Delay = TTL do código de pagamento ou `ORDER_RESERVATION_TIMEOUT_MINUTES` (default 30min)
- Worker: se pedido ainda `pending` → `cancelOrder()` com status de pagamento `expired`

### Presale — Ativação em Batch (Admin)
- `POST /orders/admin/presale/activate-batch { variantId }`
- Agrega qty total de todos os pedidos presale para essa variante
- Verifica contra stock disponível
- Transação: cada pedido → `processing`; `stock_quantity -= qty total`; `presaleEnabled → false`
- Dispara `presale.fulfilled` por pedido

---

## 8. Regras de Inventário

### Fórmula de Disponibilidade
```
availableQuantity = stockQuantity - reservedQuantity
```

### Tabela de Eventos de Stock

| Evento | `stockQuantity` | `reservedQuantity` |
|---|---|---|
| Produto criado | definido pelo admin | 0 |
| Pedido criado (normal) | — | +qty |
| Pagamento confirmado | −qty | −qty |
| Pedido cancelado (normal) | — | −qty |
| Batch presale ativado | −qty | — (era 0) |
| Update direto admin | definido | — |

### Locking Anti-Oversell
Dentro da transação de criação de pedido:
```sql
SELECT * FROM inventory WHERE variant_id = $1 FOR UPDATE
```
Recheck de stock após lock antes de incrementar `reserved_quantity`.

### Modo Presale
- Não faz reserva de `reserved_quantity`
- Conta contra `presaleLimit` (soma de qty em pedidos presale para essa variante)
- `presaleEnabled` só pode ser activado quando `availableQuantity = 0`

---

## 9. Conta do Cliente

| Endpoint | Ação |
|---|---|
| `GET /customers/me` | Perfil completo com moradas |
| `PATCH /customers/me` | firstName, lastName, phoneNumber (phone: sincroniza com Supabase, limpa `phoneVerifiedAt`) |
| CRUD `/customers/me/addresses` | Ownership verificado em cada operação |
| `GET /customers/me/orders` | Paginado, retorna `canBeCancelled` por pedido |
| `GET /customers/me/orders/:id/tracking` | Shipment + eventos |
| `DELETE /customers/me/orders/:id` | Cancelamento com idempotência |
| `PATCH /customers/me/email` | Requer email verificado; trigger Supabase change flow |
| `PATCH /customers/me/password` | Re-verifica senha atual via `signInWithPassword` |
| `GET /customers/me/export` | Export GDPR: perfil, moradas, pedidos, consentimentos |
| `DELETE /customers/me` | `isActive = false` + sign-out global Supabase |
| `POST /customers/me/consent` | Regista evento em `CustomerConsent` com IP/UA |

---

## 10. Promoções e Cupões

### Tipos
- `percent`: `eligibleSubtotal × value / 100`
- `fixed`: `min(value, eligibleSubtotal)` (não pode exceder o elegível)

### Aplicação
- Automáticas (`code = null`) ou via código (normalizado `.toUpperCase()`)
- Apenas **uma** promoção por pedido (a de maior prioridade, depois maior desconto)
- Código passado explicitamente mas sem match → `PROMO_NOT_ELIGIBLE` (nunca ignorado silenciosamente)

### Validações (todas devem passar)
1. `isActive = true`
2. Janela de datas: `startsAt <= now <= endsAt` (nulls = sem limite)
3. `minSubtotal`: subtotal ≥ limiar (se definido)
4. `maxUses`: usos totais < limite (se definido)
5. `maxUsesPerCustomer`: usos do cliente < limite (se definido)
6. Target: `cart` (aplica ao subtotal total) | `product` (apenas produtos alvo) | `category` (inclui descendentes via CTE recursiva)

### Registo
`PromotionUsage` criado **dentro da transação** de criação do pedido.

---

## 11. Envio / Shipping

### Variáveis de Ambiente
```
SHIPPING_LOCAL_CITY      default: "Luanda"
SHIPPING_FLAT_RATE       default: 0
SHIPPING_LOCAL_RATE      default: FLAT_RATE
SHIPPING_NATIONAL_RATE   default: FLAT_RATE
SHIPPING_PER_KG_RATE     default: 0
```

### Lógica
```
if address.city == SHIPPING_LOCAL_CITY → localRate
else if address.city exists            → nationalRate
else                                   → flatRate

if perKgRate > 0 AND algum item tem weightKg:
  totalShipping += totalWeight × perKgRate
```

### Shipments (Admin)
- Status: `pending | shipped | in_transit | delivered`
- Ao transitar para `shipped` → order status → `shipped`, `shippedAt` auto-set
- Ao transitar para `delivered` → order status → `delivered`, `deliveredAt` auto-set
- Log de eventos em `ShipmentEvent`
- Bloqueado em pedidos `cancelled` ou `refunded`

---

## 12. Notificações por Email

Todos os emails enfileirados via BullMQ através de `NotificationsQueueService`.
Templates por locale: `pt`, `fr`, `en`, `es`.

### Eventos
| Evento | Destinatário |
|---|---|
| `order.created` | Cliente |
| `payment.confirmed` | Cliente |
| `payment.failed` | Cliente |
| `order.shipped` | Cliente |
| `order.delivered` | Cliente |
| `order.cancelled` | Cliente |
| `presale.confirmed` | Cliente |
| `presale.fulfilled` | Cliente |
| `presale.cancelled` | Cliente |
| `welcome` | Cliente (na 1ª verificação de email) |
| `password-reset` | Cliente |
| `password-reset-confirmed` | Cliente |
| Interno (nova venda, presale, cancelamento) | `INTERNAL_NOTIFY_EMAIL` (default: `teams@stockzy.com`) |

### Regra de Filtragem de Atributos nos Emails
Atributos com nome `gender`, `genre`, `genero` ou `sexo` (case-insensitive) são **excluídos** dos itens mostrados nos emails.

### URL do Recibo
HMAC-assinada com `PAYMENT_CONFIRMATION_SECRET`.

---

## 13. Auditoria

`AuditContextMiddleware` corre em cada request, populando `AuditContextStore` (AsyncLocalStorage) com:
```
actorId, actorEmail, actorRole, ip, userAgent
```

`applyAuditContext(tx, context)` é chamado dentro de cada transação Prisma importante, propagando contexto para a sessão DB (para triggers de auditoria ao nível de row).

Registos explícitos em `AuditLog` para:
- Login / logout / change-password (admin)
- Product create / update / archive
- Image upload
- Payment create / confirm
- Attribute option changes

---

## Variáveis de Ambiente Críticas

```env
# JWT Admin
JWT_SECRET=
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=10

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# Pagamento
PAYMENT_CONFIRMATION_SECRET=
PAYMENT_CONFIRMATION_TTL_HOURS=24
PAYMENT_CONFIRMATION_MAX_ATTEMPTS=5
PAYMENT_CURRENCY=AOA
DEFAULT_CURRENCY=AOA

# Pedidos
ORDER_RESERVATION_TIMEOUT_MINUTES=30

# Shipping
SHIPPING_LOCAL_CITY=Luanda
SHIPPING_FLAT_RATE=0
SHIPPING_LOCAL_RATE=0
SHIPPING_NATIONAL_RATE=0
SHIPPING_PER_KG_RATE=0

# Produtos
PRODUCTS_CACHE_TTL_SECONDS=60
NEW_ARRIVALS_WINDOW_DAYS=30
PRODUCT_SEARCH_MODE=basic

# Notificações
INTERNAL_NOTIFY_EMAIL=teams@stockzy.com

# Rate Limiting
LOGIN_RATE_LIMIT_IP_MODE=adaptive
```
