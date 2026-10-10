# Análise — Submissão de produto por vendedor (seller)

> Só análise, nada implementado ainda (pedido explícito do utilizador: "primeiro analise e
> cria um file md de analise"). Baseado nos 2 ecrãs enviados (formulário "HYP Miami",
> `Powered By SSS-AI`) — assumo que é uma marca/cliente diferente a correr sobre o mesmo
> backend `stockzy-ecommerce-api`, não um produto à parte. Este documento propõe o desenho
> técnico (modelo de dados, máquina de estados, endpoints dos dois lados) e lista as
> decisões de negócio que preciso de confirmação antes de implementar.

## 1. O que os ecrãs mostram

**Passo 1 de 3 — "Let's Get Started" / "Tell us how to reach you":**
- `Full Name` (texto)
- `Phone Number` (selector de país + número)

**Passo 2 de 3 — "Product Details" / "Tell us about your item":**
- `Category` (dropdown — no exemplo, "Sneakers")
- `Brand` (texto)
- `Model Design / Name` (texto)
- `Size` (texto)
- `Condition` (dropdown, vazio no exemplo)
- `Original Box` (dropdown, opcional)
- `Asking Price` (número)
- `Additional Details` (textarea, opcional)
- `Link to spreadsheet` (URL, opcional — provavelmente pra listagens em lote/consignação)
- `Pictures` (até 10, obrigatório — "Take Photo" ou "Upload")
- Botão avança pra **"Review"** — passo 3 (não visto ainda, presumo ser confirmação antes
  de enviar).

**Não há campo de e-mail no passo 1** — só nome e telefone. Isso é uma decisão a confirmar
(ver secção 5) — hoje o backend só sabe notificar por e-mail (Resend) e por SMS/WhatsApp
(Twilio, dormente até configurar credenciais — ver `PLANO_INTEGRACAO_SMS_CODIGO.md`/
`PLANO_INTEGRACAO_WHATSAPP_CODIGO.md`). Se o formulário real não pede e-mail, a notificação
"pelo email" mencionada no pedido não tem pra onde ir — presumo que falta um campo de
e-mail no passo 1 que não está nestes 2 ecrãs, ou que a notificação será por SMS/WhatsApp
usando o telefone. **Preciso do ecrã do passo 3 (Review) pra confirmar isto.**

## 2. Fluxo proposto

```
[Vendedor envia formulário] → pending_review
        │
        │ (admin abre o painel de gestão, revê)
        ▼
   ┌─────────┴─────────┐
   ▼                   ▼
approved            rejected
   │                   │
   ▼                   │
[cria Product+Variant+Inventory+Images de verdade,
 publicado na loja com status "active"]
```

- **`pending_review`** — assim que o vendedor submete. E-mail automático "recebemos a sua
  submissão, está em análise" disparado neste momento (cobre o "análise" mencionado no
  pedido — não há uma fase manual separada de "começar a analisar", a menos que se decida
  que sim, ver decisão #3).
- **`approved`** — ação do admin no painel de gestão. Cria o produto de catálogo de
  verdade (ver secção 4) e dispara e-mail "o seu produto foi aprovado e já está à venda".
- **`rejected`** — ação do admin, com motivo obrigatório (`rejectionReason`, texto livre,
  mesmo padrão de `Offer.rejectionReason`). Dispara e-mail com o motivo.

Mesma forma de pensar já usada em `Offer` (`prisma/schema.prisma:407-427`) — reaproveito a
ideia de `status` + `respondedAt`/`respondedBy` + `rejectionReason`, ajustado pro caso de
"submissão de produto" em vez de "oferta de preço".

## 3. Modelo de dados proposto

```prisma
model SellerSubmission {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // Vendedor — sem conta, mesmo padrão de guest checkout/oferta (Order.guestToken,
  // Offer.guestToken): o vendedor não precisa de login, só do token pra consultar o
  // estado depois.
  sellerName       String   @map("seller_name")
  sellerPhone      String   @map("seller_phone")
  sellerEmail      String?  @map("seller_email")   // ver decisão #1 — pode ser obrigatório
  guestToken       String   @unique @map("guest_token")

  // Produto proposto
  categoryId       String?  @map("category_id") @db.Uuid   // dropdown do passo 2, se existir no catálogo
  categorySuggestion String? @map("category_suggestion")   // texto livre, se o dropdown permitir "outro"
  brand            String
  modelName        String   @map("model_name")
  size             String
  condition        String                                  // dropdown — valores fixos, ver decisão #4
  originalBox      Boolean? @map("original_box")
  askingPrice      Decimal  @map("asking_price") @db.Decimal(12, 2)
  additionalDetails String? @map("additional_details")
  spreadsheetLink  String?  @map("spreadsheet_link")

  status           seller_submission_status @default(pending_review)
  rejectionReason  String?  @map("rejection_reason")
  respondedAt      DateTime? @map("responded_at") @db.Timestamptz(6)
  respondedBy      String?  @map("responded_by") @db.Uuid   // User.id do admin/gestor

  // Preenchido só na aprovação — liga a submissão ao produto real criado
  productId        String?  @unique @map("product_id") @db.Uuid

  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  category         Category? @relation(fields: [categoryId], references: [id], onUpdate: NoAction)
  product          Product?  @relation(fields: [productId], references: [id], onUpdate: NoAction)
  images           SellerSubmissionImage[]

  @@index([status], map: "idx_seller_submissions_status")
  @@map("seller_submissions")
}

model SellerSubmissionImage {
  id                 String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  submissionId       String           @map("submission_id") @db.Uuid
  url                String
  position           Int              @default(0)
  createdAt          DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  submission         SellerSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([submissionId], map: "idx_seller_submission_images_submission")
  @@map("seller_submission_images")
}

enum seller_submission_status {
  pending_review
  approved
  rejected
}
```

Fotos sobem pro mesmo bucket Supabase já usado (`SUPABASE_BUCKET`, hoje
`product-images`), em `seller-submissions/<submissionId>/<uuid>.<ext>` — mesmo padrão de
`ProductsService.addImages()` (`products.service.ts:1795-1830`), validação por magic-bytes
(`fileTypeFromBuffer`) já estabelecida ali.

## 4. O que acontece na aprovação

"O item só é publicado pois ser aprovado e enquadrado na categoria que será setado" — leio
isto como: o vendedor já escolhe uma categoria no passo 2 (`Category: Sneakers`), e o admin
**confirma ou corrige** essa categoria no momento da aprovação (o campo é editável na tela
de revisão do painel, não só um botão "aprovar"). Ao aprovar:

1. Cria `Product` (`status: active`, `categoryId` confirmado pelo admin, `name` a partir de
   `brand` + `modelName`, `brandId` resolvido/criado a partir de `brand` — ver decisão #5).
2. Cria `ProductVariant` (`sku` gerado, `price: askingPrice`, `title: size`).
3. Cria `Inventory` (`stockQuantity: 1` — é um item usado/único, não reposição; ver decisão
   #6 se vender mais do que 1 do mesmo).
4. Copia as `SellerSubmissionImage` pra `ProductImage` (ou aponta pro mesmo URL — o
   ficheiro já está no Storage, não precisa reupload).
5. `SellerSubmission.productId` ligado ao produto criado, `status: approved`.
6. Dispara e-mail de aprovação.

Isto transforma a aprovação numa operação não-trivial (várias tabelas, numa transação) —
mesmo padrão de `ProductsService.create()` já existente, só que disparado a partir da
submissão em vez de um formulário de admin direto.

## 5. Endpoints propostos

### Portal de venda (público, sem autenticação — mesmo padrão de guest checkout/oferta)

```
POST /seller/submissions          — multipart/form-data (campos do passo 1+2, até 10 fotos)
GET  /seller/submissions/:id?token=<guestToken>   — consulta o estado da própria submissão
```

`POST` devolve `{ id, guestToken }` — o frontend guarda o token (local storage, like o
`x-cart-token`) pra poder consultar o estado depois, sem precisar de login.

### Gestão (admin)

```
GET   /admin/seller-submissions                — lista, filtro por status
GET   /admin/seller-submissions/:id             — detalhe completo
PATCH /admin/seller-submissions/:id/approve     — body: { categoryId } (confirma/corrige)
PATCH /admin/seller-submissions/:id/reject      — body: { rejectionReason }
```

Papéis: mesmo critério já usado noutros módulos de catálogo (`admin`, `manager` conseguem
rever; `support` não, a menos que decidam o contrário).

## 6. Notificações (e-mail)

Mesmo padrão de `dispatchOfferDecision()` (`notifications.service.ts:646-...`) — método
dedicado, não o `dispatch()` genérico (que é construído em torno de `Order`, não serve
aqui):

- `seller_submission.received` — automático ao submeter.
- `seller_submission.approved` — ao aprovar.
- `seller_submission.rejected` — ao rejeitar, inclui `rejectionReason`.

3 templates novos em `src/modules/notifications/templates/` (handlebars, mesmo padrão dos
existentes).

## 7. Decisões que preciso de confirmação antes de implementar

| # | Decisão | Por quê importa |
|---|---|---|
| 1 | O passo 1 tem campo de e-mail que não apareceu nos 2 ecrãs enviados (só nome/telefone)? | Sem e-mail, não há como mandar a notificação "pelo email" pedida — a menos que seja SMS/WhatsApp pelo telefone, ou o passo 3 (Review, não visto) peça o e-mail. |
| 2 | Vendedor sem conta (guest, como oferta/checkout) ou precisa de registar/logar? | Muda o modelo de dados (ligar a `Customer` ou não) e se há histórico de submissões por conta. |
| 3 | Existe uma fase manual "em análise" separada de "recebido", ou "recebido" já é "em análise" (e-mail único na submissão)? | Pedido diz 3 fases notificadas (análise/aprovação/rejeição) — hoje modelei como 2 transições reais (pending_review→approved/rejected) com e-mail na entrada e nas duas saídas. Se quiserem uma transição manual extra ("admin marca como 'em revisão ativa'"), é um estado a mais. |
| 4 | Valores fixos de `Condition` e `Original Box` (dropdowns vazios no ecrã)? | Preciso da lista exata (ex.: `New`, `Like New`, `Used - Good`, `Used - Fair`?) pra validar no DTO. |
| 5 | `Brand` do formulário é texto livre, ou deve casar com o catálogo de `Brand` já existente (`admin/brands`)? | Texto livre pode criar marcas duplicadas/inconsistentes no catálogo; casar com o existente exige autocomplete no formulário. |
| 6 | Pode haver mais de 1 unidade do mesmo item (reposição), ou é sempre peça única (stock 1, esgota ao vender)? | Define `Inventory.stockQuantity` na aprovação e se faz sentido pedir "quantidade" no formulário. |
| 7 | Vendedor pode reenviar depois de rejeitado, ou é definitivo? | Se pode reenviar, precisa de um caminho (nova submissão, ou reabrir a mesma). |
| 8 | Existe comissão/split de pagamento pro vendedor quando o item vende? | Fora do que os 2 ecrãs mostram, mas "plataforma" + "vendedor" costuma implicar isso — se sim, é uma peça bem maior (pagamento ao vendedor, não só publicar o produto) que merece o próprio levantamento separado. |
| 9 | Fotos enviadas pelo vendedor vão direto pra loja, ou a equipa интерна re-fotografa antes de publicar? | Se há re-fotografia, a aprovação não deve copiar as fotos automaticamente — fica um passo manual de upload pelo admin, as fotos do vendedor servem só de referência interna. |

## 8. Próximo passo

Mandem o ecrã do passo 3 (Review) e as respostas às 9 decisões acima — principalmente #1
(e-mail), #2 (conta ou guest) e #8 (comissão, porque muda o tamanho do projeto todo) — e eu
fecho o desenho final e começo a implementação (schema, migração, endpoints dos dois lados,
templates de e-mail).
