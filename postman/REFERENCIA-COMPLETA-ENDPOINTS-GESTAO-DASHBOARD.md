# Referência completa — Endpoints de Gestão (admin/*) e Dashboard

> Documento único, cobrindo os 87 endpoints `admin/*` + o dashboard. Testado ao vivo contra
> o banco real nesta sessão (login, CRUD de produto com upload de imagem, auditoria,
> controle de acesso por papel) — os exemplos marcados **"real"** vieram de chamadas de
> verdade; o resto foi construído direto da definição exata do DTO/model (não é chute).

---

## Índice

1. [Convenções gerais](#1-convenções-gerais)
2. [Autenticação e Usuários de Staff](#2-autenticação-e-usuários-de-staff)
3. [Dashboard](#3-dashboard)
4. [Produtos](#4-produtos)
5. [Categorias](#5-categorias)
6. [Marcas](#6-marcas)
7. [Facetas](#7-facetas)
8. [Pedidos](#8-pedidos)
9. [Clientes](#9-clientes)
10. [Promoções](#10-promoções)
11. [Homepage (Hero / Tiles / Social)](#11-homepage-hero--tiles--social)
12. [Banners](#12-banners)
13. [Anúncios](#13-anúncios)
14. [Newsletter](#14-newsletter)
15. [Ofertas (Make Offer)](#15-ofertas-make-offer)
16. [Pagamentos](#16-pagamentos)
17. [Envios](#17-envios)
18. [Auditoria e Segurança](#18-auditoria-e-segurança)
19. [Relatórios externos (fora do JWT de staff)](#19-relatórios-externos-fora-do-jwt-de-staff)

---

## 1. Convenções gerais

**Base URL:** `http://localhost:3000` (dev) — em produção, o domínio do deploy.

**Autenticação:** `POST /admin/auth/login` devolve um JWT — enviar em toda chamada
seguinte como `Authorization: Bearer <token>`. Token expira em 7 dias; usar
`POST /admin/auth/refresh` pra renovar sem novo login.

**Papéis (`role`):** `admin` (acesso total), `manager` (tudo exceto delete em produtos/
promoções/usuários), `support` (só leitura em `admin/orders` e `admin/customers`, e no
`admin/dashboard/summary`). Fora desse recorte, `support` recebe `403`.

**Paginação:** toda listagem devolve `{ data: [...], meta: {...} }`. `meta.mode` diz qual
dos dois esquemas está ativo:
- `mode: "offset"` → `{ mode, total, page, limit, totalPages }` — paginar com `?page=`
- `mode: "cursor"` → `{ mode, limit, nextCursor }` — paginar com `?cursor=<nextCursor>`

Ambos os modos coexistem no mesmo endpoint — manda `?cursor=` pra ativar o modo cursor,
senão cai no offset por `?page=`/`?limit=`.

**Auditoria:** toda mutação (create/update/delete/deactivate) é registrada e aparece em
`GET /admin/audit-logs`, com `actorId`/`actorEmail`/`actorRole` de quem fez.

**Erros:** formato padrão do Nest —
```json
{ "message": "descrição do erro (ou array de mensagens de validação)", "error": "Bad Request", "statusCode": 400 }
```

---

## 2. Autenticação e Usuários de Staff

### `POST /admin/auth/login` — público, rate-limited

**Body:** `{ "email": "string", "password": "string" }`

**Resposta 200 (real):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "7d",
  "refreshExpiresIn": "7d",
  "user": { "id": "uuid", "name": "Administrador Stockzy", "email": "admin@stockzy.com", "role": "admin" }
}
```
Além do token na resposta, um refresh token é setado como cookie httpOnly.

### `POST /admin/auth/refresh` — público
Lê o cookie de refresh, devolve novo `accessToken` no mesmo formato do login.

### `POST /admin/auth/logout` — público
Invalida o refresh token / limpa o cookie. Resposta: `{ "success": true }`.

### `GET /admin/auth/me` — autenticado
Devolve o payload cru do JWT decodificado:
```json
{ "sub": "uuid-do-usuario", "role": "admin", "email": "admin@stockzy.com", "iat": 1234567890, "exp": 1234567890 }
```

### `POST /admin/auth/change-password` — autenticado
**Body:** `{ "currentPassword": "string", "newPassword": "string" }`

---

### `GET /admin/users` — `admin`, `manager`
**Query:** `page`, `limit`, `role` (`admin|manager|support`), `isActive` (`true|false`), `search`

**Resposta 200:**
```json
{
  "data": [
    { "id": "uuid", "name": "Suporte Stockzy", "email": "suporte@stockzy.com", "role": "support", "isActive": true, "createdAt": "...", "updatedAt": "..." }
  ],
  "meta": { "mode": "offset", "total": 2, "page": 1, "limit": 20, "totalPages": 1 }
}
```
(o campo `passwordHash` nunca é devolvido)

### `POST /admin/users` — `admin`, `manager`
**Body:** `{ "name": "string", "email": "string", "password": "string (min 6)", "role"?: "admin|manager|support", "isActive"?: boolean }`

### `GET /admin/users/:id` — `admin`, `manager`
### `PATCH /admin/users/:id` — `admin`, `manager`
Mesmo body do create, todos os campos opcionais.

### `PATCH /admin/users/:id/deactivate` — `admin`, `manager`
### `DELETE /admin/users/:id` — `admin`, `manager`

---

## 3. Dashboard

### `GET /admin/dashboard/summary` — `admin`, `manager`, `support`

Único endpoint criado do zero nesta sessão — agrega KPIs de vendas, estoque baixo e
crescimento, tudo acessível pelo login normal de staff (antes só existia via
`admin/reports`, com API key separada).

**Resposta 200 (real, dados de dev):**
```json
{
  "sales": {
    "totalOrders": 23,
    "totalRevenue": 9675,
    "byStatus": { "pending": 3, "paid": 6, "cancelled": 14 },
    "today": { "orders": 0, "revenue": 0 },
    "thisMonth": { "orders": 23, "revenue": 9675 },
    "recentOrders": [
      {
        "id": "uuid", "orderNumber": "STKZ-00010022", "status": "cancelled",
        "totalAmount": "80", "createdAt": "...",
        "customer": null,
        "items": [{ "productName": "...", "quantity": 1, "totalPrice": "80" }]
      }
    ]
  },
  "pendingOrders": 3,
  "lowStock": {
    "threshold": 5,
    "count": 1242,
    "items": [
      { "variantId": "uuid", "sku": "DEV-A9BFE6A6-S", "productId": "uuid", "productName": "Leather Shorts Brown", "productSlug": "...", "available": 1 }
    ]
  },
  "newCustomers7d": 0,
  "newNewsletterSubscribers7d": 0
}
```
`lowStock.items` traz só uma amostra de 10, ordenada do mais crítico pro menos.
`lowStock.count` alto em dev reflete o padrão de seed (a maioria dos variantes tem 5
unidades) — em produção, com estoque real, esse número reflete a realidade.

---

## 4. Produtos

### `GET /admin/products` — `admin`, `manager`
**Query:** `page`, `limit`, `search`, `status` (`draft|active|archived`), `featured`
(`true|false`), `categoryId`, `minPrice`, `maxPrice`, `sort`
(`featured|price_asc|price_desc|newest|relevance`), `inStock`, `belowRetail`, `brand`
(slug, repetível), `facets` (`"chave:valor1|valor2;chave2:valor3"`)

Resposta: `{ data: Product[] (completo, com variants/images/brand/category), meta }`.

### `POST /admin/products` — `admin`
**Body (real, testado):**
```json
{
  "categoryId": "uuid",
  "brandId": "uuid (opcional)",
  "name": "Camiseta Exemplo",
  "slug": "camiseta-exemplo",
  "description": "opcional",
  "status": "active",
  "featured": false,
  "variants": [
    { "sku": "opcional (se ausente, gerado a partir da cor)", "title": "P", "price": 79.90, "compareAtPrice": 99.90, "stockQuantity": 10, "facetValueIds": ["uuid-da-cor", "uuid-do-tamanho"] }
  ],
  "facetValueIds": ["uuid-do-gender", "uuid-da-activity"]
}
```
> Se `sku` não vier e não houver faceta de cor no variante, dá `400`: "Cor is required for
> SKU generation." — testado ao vivo.

**Resposta 201 (real):**
```json
{
  "id": "uuid", "categoryId": "uuid", "brandId": null,
  "name": "[TESTE ROBUSTO] Camiseta Validacao", "slug": "teste-robusto-camiseta-validacao",
  "description": null, "status": "active", "featured": false,
  "featuredUntil": null, "featuredOrder": null, "displayOrder": null,
  "createdAt": "...", "updatedAt": "..."
}
```

### `GET /admin/products/:id` — `admin`, `manager`
Detalhe completo (real, testado):
```json
{
  "id": "uuid", "name": "...", "slug": "...", "status": "active",
  "variants": [
    {
      "id": "uuid", "sku": "TESTE-ROBUSTO-M", "title": "M", "price": "79.9", "compareAtPrice": null,
      "isActive": true, "presaleEnabled": false,
      "inventory": { "stockQuantity": 8, "reservedQuantity": 0 },
      "facetValues": [],
      "availableQuantity": 8, "isAvailable": true, "purchaseMode": "normal"
    }
  ],
  "images": [
    { "id": "uuid", "variantId": null, "url": "https://.../products/<id>/product/<uuid>.png", "position": 0 },
    { "id": "uuid", "variantId": "uuid-da-variante-m", "url": "https://.../products/<id>/variant-<variantId>/<uuid>.png", "position": 0 }
  ],
  "category": { "id": "uuid", "name": "Tops", "slug": "tops", "familyTag": "vestuario" },
  "brand": null,
  "facetValues": []
}
```
`purchaseMode`: `normal | presale | sold_out | presale_sold_out`.

### `PATCH /admin/products/:id` — `admin`
Mesmo shape do create, todos os campos opcionais (inclusive `variants[]` pra
adicionar/editar). Propaga imediatamente pro lado público.

### `POST /admin/products/:id/images` — `admin`
**multipart/form-data**, campo `files` (até 10). Query opcional `?variantId=<uuid>` liga a
foto a uma variante específica (ex.: foto da cor preta) — sem isso, a foto é do produto
como um todo.

**Resposta 201 (real, array com as fotos recém-criadas):**
```json
[
  { "id": "uuid", "productId": "uuid", "variantId": null, "url": "https://jmenpbpgbhepfudjrnct.supabase.co/storage/v1/object/public/product-images/products/<id>/product/<uuid>.png", "altText": "nome-original-do-arquivo.png", "position": 0, "createdAt": "...", "updatedAt": "..." }
]
```
Validação real por magic-bytes (`fileTypeFromBuffer`), não só pela extensão — só aceita
JPEG/PNG/WebP/GIF de verdade.

### `PATCH /admin/products/reorder` — `admin`, `manager`
**Body:** `{ "products": [{ "id": "uuid", "position": 1 }, ...] }`

### `PATCH /admin/products/:id/archive` — `admin`
### `DELETE /admin/products/:id` — `admin`

**As duas fazem a mesma coisa: soft-delete.** Testado ao vivo — o registro continua no
banco com `status: 'archived'`, some da loja pública (`404`) e do `findAll` padrão do
admin, mas as fotos **continuam existindo no Storage** (não são apagadas).

### `PATCH /admin/products/variants/:id/presale`  — `admin`, `manager`
**Body:** `{ "presaleEnabled": true, "presalePrice"?: number, "presaleLimit"?: number, "expectedAvailableAt"?: "ISO date" }`

### `GET /admin/products/:id/price-history` — `admin`, `manager`
Histórico de mudança de preço por variante (quem mudou, de quanto pra quanto, quando).

---

## 5. Categorias

### `GET /admin/categories` — `admin`, `manager`
**Query:** `page`, `limit`, `parentId`, `search`, `isActive`

### `POST /admin/categories` — `admin`, `manager`
**Body:**
```json
{ "name": "Bottoms", "slug": "bottoms", "code"?: "BOT", "parentId"?: "uuid", "familyTag"?: "vestuario", "bannerTitle"?: "string", "bannerDescription"?: "string" }
```

### `GET /admin/categories/:id` — `admin`, `manager`
### `PATCH /admin/categories/:id` — `admin`, `manager`
Mesmo body do create, todos opcionais, mais `isActive`.

### `PATCH /admin/categories/:id/deactivate` — `admin`, `manager`
### `DELETE /admin/categories/:id` — `admin`, `manager`

### `POST /admin/categories/:id/merge` — `admin`, `manager`
**Body:** `{ "targetCategoryId": "uuid" }` — move todo produto da categoria `:id` pra
`targetCategoryId`, depois desativa a origem. Útil pra consolidar categorias duplicadas.

---

## 6. Marcas

### `GET /admin/brands` — `admin`, `manager`
**Query:** `page`, `limit`, `search`, `isActive`

**Resposta (real):**
```json
{ "data": [{ "id": "uuid", "name": "Nike", "slug": "nike", "logoUrl": "https://...", "isActive": true }], "meta": { "mode": "offset", "total": 96, "page": 1, "limit": 20, "totalPages": 5 } }
```

### `POST /admin/brands` — `admin`, `manager`
**Body:** `{ "name": "string", "slug": "string", "logoUrl"?: "string", "isActive"?: boolean }`

### `GET /admin/brands/:id` — `admin`, `manager`
### `PATCH /admin/brands/:id` — `admin`, `manager`
### `PATCH /admin/brands/:id/deactivate` — `admin`, `manager`
### `DELETE /admin/brands/:id` — `admin`, `manager`
> Bloqueia com `400` se ainda houver produto vinculado à marca ("Cannot deactivate brand: N product(s) still linked").

---

## 7. Facetas

Facetas são a base do sistema de filtro do catálogo (`gender`, `color`, `garment_type`,
`size_apparel`, etc.) — cada faceta tem um ou mais **valores**.

### `GET /admin/facets` — `admin`, `manager`
**Query:** `isActive`, `scope` (`product|variant`) — **não aceita** `page`/`limit`, devolve
a lista inteira (poucas dezenas de facetas no total, não precisa paginar).

**Resposta:** array de facetas, cada uma já com `values[]` embutido:
```json
[
  {
    "id": "uuid", "key": "gender", "name": "Gender", "inputType": "checkbox", "scope": "product",
    "visibility": "gender_fixed_absent", "visibilityValue": null, "sortOrder": 10, "isActive": true,
    "values": [{ "id": "uuid", "value": "men", "label": "Men", "sortOrder": 1, "isActive": true }]
  }
]
```

### `POST /admin/facets` — `admin`, `manager`
**Body:**
```json
{
  "key": "activity", "name": "Activity", "inputType": "checkbox",
  "scope"?: "product", "visibility"?: "always", "visibilityValue"?: "string",
  "sortOrder"?: 10, "isActive"?: true
}
```
`key` precisa ser `snake_case` minúsculo (`^[a-z][a-z0-9_]*$`).
`inputType`: `link | checkbox | swatch | slider | chip`.
`visibility`: `always | category_family | gender_fixed_absent | gender_equals`.

### `GET /admin/facets/:id` / `PATCH /admin/facets/:id` / `DELETE /admin/facets/:id` — `admin`, `manager`

### `POST /admin/facets/:facetId/values` — `admin`, `manager`
**Body:**
```json
{ "value": "running", "label": "Running", "extra"?: { "hex": "#000000" }, "sortOrder"?: 1, "isActive"?: true, "bannerTitle"?: "string", "bannerDescription"?: "string" }
```

### `PATCH /admin/facets/:facetId/values/:id` — `admin`, `manager`
### `DELETE /admin/facets/:facetId/values/:id` — `admin`, `manager`

---

## 8. Pedidos

### `GET /admin/orders` — `admin`, `manager`, `support`
**Query:** `page`, `limit`, `customerId`, `status`
(`pending|paid|presale|processing|shipped|delivered|cancelled|refunded`), `cursor`

**Resposta (real):**
```json
{
  "data": [
    {
      "id": "uuid", "orderNumber": "STKZ-00010022", "status": "cancelled",
      "subtotal": "80", "shippingAmount": "0", "discountAmount": "0", "totalAmount": "80",
      "shippingAddress": { "country": "AO" }, "billingAddress": null,
      "locale": "fr", "guestPhone": "+244987654321", "guestToken": "uuid",
      "customerId": null, "customer": null,
      "items": [{ "productName": "...", "quantity": 1, "totalPrice": "80" }],
      "createdAt": "...", "updatedAt": "..."
    }
  ],
  "meta": { "mode": "offset", "total": 23, "page": 1, "limit": 20, "totalPages": 2 }
}
```

### `POST /admin/orders` — `admin`, `manager`
Criação manual de pedido (ex.: venda por telefone). **Body:**
```json
{
  "customerId"?: "uuid", "status"?: "pending",
  "subtotal": 100, "shippingAmount"?: 0, "discountAmount"?: 0, "totalAmount": 100,
  "shippingAddress"?: {}, "billingAddress"?: {},
  "items": [{ "variantId": "uuid", "productName": "string", "sku": "string", "quantity": 1, "unitPrice": 100, "totalPrice": 100 }]
}
```

### `GET /admin/orders/:id` — `admin`, `manager`, `support`
### `PATCH /admin/orders/:id` — `admin`, `manager`
Edita qualquer campo do pedido (mesmo shape do create, tudo opcional, incluindo
substituir `items[]` inteiro).

### `PATCH /admin/orders/:id/status` — `admin`, `manager`
**Body:** `{ "status": "shipped" }`

### `PATCH /admin/orders/:id/cancel` — `admin`, `manager`
**Headers opcionais:** `idempotency-key` ou `x-idempotency-key` (evita cancelar 2x por
retry de rede).

### `POST /admin/orders/presale/activate` — `admin`, `manager`
**Body:** `{ "variantId": "uuid" }` — ativa em lote todos os pedidos de presale esperando
essa variante ficar disponível.

### `DELETE /admin/orders/:id` — `admin`, `manager`
Mesmo efeito de `cancel` (aceita os mesmos headers de idempotência).

---

## 9. Clientes

### `GET /admin/customers` — `admin`, `manager`, `support`
**Query:** `page`, `limit`, `isActive`, `search`, `cursor`

**Resposta:**
```json
{
  "data": [{ "id": "uuid", "authUserId": "uuid", "firstName": null, "lastName": null, "email": "...", "phoneNumber": "...", "isActive": true, "createdAt": "...", "updatedAt": "..." }],
  "meta": { "mode": "offset", "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```
(nunca inclui `passwordHash`)

### `GET /admin/customers/full` — `admin`, `manager` (⚠️ **não** inclui `support`)
Mesma listagem, mas cada cliente já vem com `addresses[]`, `orders[]` (+items) e `carts[]`
(+items) embutidos — mais pesado, evitar em listagem grande.

### `GET /admin/customers/export` — `admin`, `manager` (⚠️ **não** inclui `support`)
Export em massa dos dados de cliente — decisão de propósito: é extração de PII, escopo
diferente de "consultar cliente pra atender chamado".

### `GET /admin/customers/:id` — `admin`, `manager`, `support`
### `GET /admin/customers/:id/export` — `admin`, `manager`
### `PATCH /admin/customers/:id` — `admin`, `manager`
**Body:** `{ "firstName"?, "lastName"?, "phoneNumber"?, "isActive"? }`

### `PATCH /admin/customers/:id/deactivate` — `admin`, `manager`

---

## 10. Promoções

### `GET /admin/promotions` — `admin` (⚠️ único módulo, junto com produtos, restrito a `admin` — nem `manager` acessa)
**Query:** `page`, `limit`, `isActive`, `search`, `code`, `cursor`

### `POST /admin/promotions` — `admin`
**Body (real, testado):**
```json
{
  "name": "Black Friday", "code": "BF2026", "type": "percent", "value": 20,
  "isActive"?: true, "startsAt"?: "ISO date", "endsAt"?: "ISO date", "priority"?: 0,
  "minSubtotal"?: 100, "maxUses"?: 500, "maxUsesPerCustomer"?: 1, "label"?: "string",
  "targets"?: [{ "type": "product", "productId": "uuid" }, { "type": "category", "categoryId": "uuid" }]
}
```
`type`: `percent | fixed`.

**Resposta (real):**
```json
{ "id": "uuid", "name": "[TESTE AUDITORIA]", "code": "AUDITTEST26", "type": "percent", "value": "5", "isActive": false, "priority": 0, "targets": [], "_count": { "usages": 0 } }
```

### `GET /admin/promotions/:id` — `admin`
### `PATCH /admin/promotions/:id` — `admin`
### `PATCH /admin/promotions/:id/deactivate` — `admin`

---

## 11. Homepage (Hero / Tiles / Social)

### `PUT /admin/homepage/hero` — `admin`, `manager`
Registro único (não é lista) — sempre atualiza o hero ativo, ou cria se nunca existiu.
**Body:**
```json
{ "desktopImage"?: "url", "mobileImage"?: "url", "eyebrow"?: "string", "title"?: "string", "ctaLabel"?: "string", "ctaHref"?: "string", "isActive"?: true }
```

### `POST /admin/homepage/hero/upload` — `admin`, `manager`
**multipart/form-data**, campos `desktopImage` e/ou `mobileImage` (1 arquivo cada, máx
5MB). Sobe pro Supabase Storage e já salva a URL no hero.

### `GET /admin/homepage/tiles` — `admin`, `manager`
**Query:** `section` (filtra por seção, ex. `"categorias-destaque"`) — devolve **todos**,
inclusive inativos (diferente do `GET /homepage/tiles` público, que só mostra ativos).

### `POST /admin/homepage/tiles` — `admin`, `manager`
**Body:** `{ "section"?: "string", "title": "string", "href": "string", "imageSrc": "string", "mobileImageSrc"?: "string", "position"?: 0, "isActive"?: true }`

### `PATCH /admin/homepage/tiles/:id` — `admin`, `manager`
### `DELETE /admin/homepage/tiles/:id` — `admin`, `manager`

### `PATCH /admin/homepage/social/config` — `admin`, `manager`
Registro único — configuração do feed social (ex. Instagram) da home.
**Body:** `{ "handle"?: "@marca", "followHref"?: "https://instagram.com/marca" }`

### `POST /admin/homepage/social/images` — `admin`, `manager`
**Body:** `{ "imageSrc": "url", "alt": "string", "href"?: "string", "position"?: 0, "isActive"?: true }`

### `PATCH /admin/homepage/social/images/:id` — `admin`, `manager`
### `DELETE /admin/homepage/social/images/:id` — `admin`, `manager`

---

## 12. Banners

### `GET /admin/banners` — `admin`, `manager`
**Query:** `page`, `limit`, `isActive`, `active` (`true` = só os vigentes na janela de
data), `cursor`

### `POST /admin/banners` — `admin`, `manager`
**Body (real, testado):**
```json
{
  "title": "string", "subtitle"?: "string", "imageUrl": "url",
  "imageWidth"?: 1920, "imageHeight"?: 600, "mobileImageUrl"?: "url",
  "altText"?: "string", "href"?: "string", "ctaText"?: "string", "ctaLink"?: "string",
  "context"?: "string (ex.: nome da seção onde aparece)", "position"?: 0, "isActive"?: true,
  "startsAt"?: "ISO date", "endsAt"?: "ISO date"
}
```

### `POST /admin/banners/:id/image` — `admin`, `manager`
**multipart/form-data**, campo `file` (1 arquivo, máx 5MB) — sobe e já atualiza `imageUrl`.

### `GET /admin/banners/:id` — `admin`, `manager`
### `PATCH /admin/banners/:id` — `admin`, `manager`
### `PATCH /admin/banners/:id/deactivate` — `admin`, `manager`
### `DELETE /admin/banners/:id` — `admin`, `manager`

---

## 13. Anúncios

Barra de anúncio do topo do site (multi-idioma).

### `GET /admin/announcements` — `admin`, `manager`
**Query:** `page`, `limit`, `isActive`, `cursor`

### `POST /admin/announcements` — `admin`, `manager`
**Body (real, testado):**
```json
{
  "textPt": "string (obrigatório)", "textFr"?: "string", "textEn"?: "string", "textEs"?: "string",
  "link"?: "string", "linkTextPt"?: "string", "linkTextFr"?: "string", "linkTextEn"?: "string", "linkTextEs"?: "string",
  "isActive"?: true, "startsAt"?: "ISO date", "endsAt"?: "ISO date", "position"?: 0
}
```

### `GET /admin/announcements/:id` — `admin`, `manager`
### `PATCH /admin/announcements/:id` — `admin`, `manager`
### `PATCH /admin/announcements/:id/deactivate` — `admin`, `manager`
### `DELETE /admin/announcements/:id` — `admin`, `manager`

---

## 14. Newsletter

### `GET /admin/newsletter/subscriptions` — `admin`, `manager`
**Query:** `page`, `limit`, `activeOnly` (`true` por padrão)

**Resposta (shape diferente do resto — sem envelope `meta`, é assim desde antes desta
sessão, não mexi na estrutura pra não quebrar quem já consome):**
```json
{ "data": [{ "id": "uuid", "email": "...", "isActive": true, "subscribedAt": "..." }], "mode": "offset", "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
```

### `GET /admin/newsletter/subscriptions/export` — `admin`, `manager`
**Query:** `activeOnly`

### `DELETE /admin/newsletter/subscriptions/:id` — `admin`, `manager`

---

## 15. Ofertas (Make Offer)

> Tabela `offers` foi criada nesta sessão (`SQL_CREATE_OFFERS_TABLE.sql`) — antes, todo
> este módulo respondia `500`. Confirmado ao vivo: `GET /admin/offers` já responde `200`.

### `GET /admin/offers` — `admin`, `manager`
**Query:** `status` (`pending|pending_window|accepted|rejected|expired|converted`)

### `PATCH /admin/offers/:id/accept` — `admin`, `manager`
Reserva estoque, marca como `accepted`, dispara notificação e agenda o timeout de
checkout. Erros possíveis: `OFFER_NOT_PENDING`, `OFFER_EXPIRED`, `OFFER_SOLD_OUT`.

### `PATCH /admin/offers/:id/reject` — `admin`, `manager`
**Body:** `{ "reason"?: "below_minimum" | "sold_out" | "other" }`

---

## 16. Pagamentos

Só leitura — pagamento é reflexo do que acontece no Stripe/cartão, não se cria/edita
manualmente por aqui.

### `GET /admin/payments` — `admin`, `manager`
**Query:** `status` (`pending|failed|awaiting_confirmation|paid|cancelled|expired`),
`orderId`, `customerId`, `page`, `limit`, `cursor`

**Resposta:**
```json
{
  "data": [{ "id": "uuid", "orderId": "uuid", "method": "stripe", "status": "paid", "amount": "80.00", "currency": "eur", "confirmedAt": "...", "order": {} }],
  "meta": { "mode": "offset", "total": 6, "page": 1, "limit": 20, "totalPages": 1 }
}
```
`method`: `cod | stripe`.

### `GET /admin/payments/:id` — `admin`, `manager`

---

## 17. Envios

### `GET /admin/shipments` — `admin`, `manager`
**Query:** `orderId`, `status`
(`pending|shipped|in_transit|delivered|failed|returned|cancelled`), `trackingNumber`
(busca parcial), `page`, `limit`, `cursor`

### `POST /admin/shipments` — `admin`, `manager`
**Body:**
```json
{ "orderId": "uuid", "status"?: "pending", "carrier"?: "string", "trackingNumber"?: "string", "trackingUrl"?: "string", "serviceLevel"?: "string", "shippedAt"?: "ISO date", "deliveredAt"?: "ISO date", "estimatedDeliveryAt"?: "ISO date", "metadata"?: {} }
```

### `GET /admin/shipments/:id` — `admin`, `manager`
Inclui `events[]` (linha do tempo de rastreio).

### `PATCH /admin/shipments/:id` — `admin`, `manager`
Mesmo body do create, tudo opcional.

### `POST /admin/shipments/:id/events` — `admin`, `manager`
Adiciona um evento de rastreio (ex.: "saiu pra entrega").
**Body:** `{ "status": "in_transit", "message"?: "string", "location"?: "string", "occurredAt"?: "ISO date", "metadata"?: {} }`

---

## 18. Auditoria e Segurança

### `GET /admin/audit-logs` — `admin`, `manager`
**Query:** `actorId`, `actorEmail`, `action`, `entity`, `entityId`, `from`/`to` (ISO date),
`limit` (máx 200), `cursor`

**Resposta (real):**
```json
{
  "data": [
    { "id": "uuid", "actorId": "uuid", "actorEmail": "admin@stockzy.com", "actorRole": "admin", "action": "archive", "entity": "product", "entityId": "uuid", "before": {}, "after": {}, "ip": "...", "userAgent": "...", "createdAt": "..." }
  ],
  "meta": { "mode": "cursor", "limit": 50, "nextCursor": "uuid|null" }
}
```
`before`/`after` guardam um retrato do registro antes/depois da mutação (nunca incluem
`passwordHash`, mesmo pra `entity: "customer"` ou `"user"`). Uma entrada de auditoria
**sobrevive** mesmo se o usuário que a gerou for depois apagado — o email fica gravado
como texto, não como referência à tabela `users`.

### `GET /admin/login-rate-limit-audits` — `admin`, `manager`
**Query:** `email`, `ip`, `from`/`to`, `limit`, `cursor`

Registra tentativas de login bloqueadas por rate limit — quem, de qual IP, quantas
tentativas, até quando ficou bloqueado.

---

## 19. Relatórios externos (fora do JWT de staff)

Estes **não** usam o login normal — são protegidos por uma API key estática
(`x-admin-key` / `ADMIN_API_KEY`), pensados pra integração externa (BI, script, dashboard
de terceiro), não pro app de gestão em si:

| Endpoint | Descrição |
|---|---|
| `GET /admin/reports/orders` | Lista de pedidos (mesmo filtro de `QueryOrderDto`) |
| `GET /admin/reports/orders/:id` | Detalhe de um pedido |
| `GET /admin/reports/sales` | O mesmo resumo de vendas usado em `admin/dashboard/summary` |

Pra essas 3, use `curl -H "x-admin-key: <ADMIN_API_KEY>"` em vez de `Authorization: Bearer`.
