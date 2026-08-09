# Análise do Backend — Estrutura, Banco de Dados e Regras de Negócio

> Gerado em 2026-07-25. Base para planear a evolução deste backend (copiado do projeto "Doja Paris") para uma nova versão/projeto ("stockzy-ecommerce-api").
> Este documento cobre **estrutura + schema + riscos de migração**. Para o detalhe passo-a-passo de cada fluxo (login, checkout, pagamento, etc.) ver [`BACKEND_BUSINESS_RULES.md`](./BACKEND_BUSINESS_RULES.md), que já é bastante completo e não é duplicado aqui.

---

## 1. Stack e Arquitetura

- **Framework:** NestJS 11 (módulos por domínio, guards globais)
- **ORM/DB:** Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- **Cache/Filas:** Redis (carrinho, idempotência, rate-limit, cache de produtos) + BullMQ (emails, timeout de reserva de pedido, jobs assíncronos)
- **Storage/Auth de cliente:** Supabase (Auth para customers, Storage para imagens/assets de email)
- **Pagamentos:** Stripe (cartão) + fluxo próprio "COD" (confirmação manual por código)
- **Observabilidade:** OpenTelemetry, Sentry, Prometheus (`prom-client`)
- **Deploy:** Docker + Railway (`railway.toml`, `Dockerfile` — genéricos, sem referências ao projeto antigo)

Padrão de módulo consistente em `src/modules/<dominio>/`: `*.module.ts`, `*.service.ts`, `*.controller.ts` (+ `*.admin.controller.ts` quando há rotas admin separadas), `dto/`. 20 módulos de domínio, todos registados em `app.module.ts` com guards globais (`ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`) e `AuditContextMiddleware` aplicado a todas as rotas.

---

## 2. Modelo de Dados (`prisma/schema.prisma`)

40 models + 9 enums. Agrupados por domínio:

| Domínio | Models |
|---|---|
| Identidade admin | `User`, `RefreshToken` |
| Cliente | `Customer`, `CustomerConsent`, `Address` |
| Catálogo | `Category`, `Product`, `ProductVariant`, `Inventory`, `ProductImage`, `PriceHistory`, `SkuSequence`, `CategoryAttribute`, `AttributeOption`, `VariantAttributeValue`, `ProductRanking` |
| Carrinho | `Cart`, `CartItem` (nota: **carrinho real vive no Redis**, estas tabelas existem no schema mas o fluxo de checkout usa Redis puro — ver `BACKEND_BUSINESS_RULES.md` §4. Confirmar se `Cart`/`CartItem` ainda são usadas em algum caminho de código antes de assumir que são legado morto) |
| Pedido/Pagamento | `Order`, `OrderItem`, `Payment`, `Shipment`, `ShipmentEvent` |
| Promoções | `Promotion`, `PromotionTarget`, `PromotionUsage` |
| Descoberta/Analytics | `ProductView`, `ProductCoOccurrence`, `Wishlist`, `WishlistItem` |
| Conteúdo/Homepage | `Banner`, `Announcement`, `HeroBanner`, `HomepageTile`, `SocialFeedConfig`, `SocialFeedImage` |
| Newsletter | `NewsletterSubscription` |
| Auditoria/Segurança | `AuditLog`, `LoginRateLimitAudit` |

### Enums
`address_type`, `order_status`, `payment_status`, `payment_method` (`cod`, `stripe` — **sem PIX, boleto, transferência**), `product_status`, `shipment_status`, `promotion_type`, `promotion_target_type`, `user_role` (`admin`, `manager`, `support`).

### Padrões de schema a manter/repetir na nova versão
- Todo PK é `uuid` via `gen_random_uuid()`
- `camelCase` no Prisma ↔ `snake_case` no banco via `@map` / `@@map` (consistente em 100% dos models)
- Timestamps `created_at`/`updated_at` em quase todos os models, `@db.Timestamptz(6)`
- `onDelete: Cascade` é o padrão para filhos diretos (ex.: `OrderItem`, `CartItem`, `ProductVariant→Inventory`); `SetNull` usado deliberadamente em `PromotionUsage.customerId/orderId` e `ProductView.customerId` (preserva histórico mesmo se cliente/pedido for apagado)
- Índices compostos pensados para as queries reais (ex. `idx_co_occ_product_a_score`, `idx_promotions_window`) — não são genéricos, foram desenhados a dedo

### Pontos de atenção no schema para uma "nova versão"
1. **Moeda/localização assumida**: `Payment.currency` é `String` livre, mas toda a lógica de negócio (fallback `AOA`, cidade local `Luanda` no shipping) assume Angola/moeda AOA como default. Isto é config (`.env`), não schema, mas é decisão de produto a confirmar cedo.
2. **`Order.locale` default `"pt"`** — idiomas suportados nos templates são `pt/fr/en/es` (mercado lusófono/francófono). Confirmar se a nova versão mantém os 4 locales ou reduz/expande.
3. **`user_role` fixo em 3 valores** (`admin/manager/support`) sem tabela de permissões granular — se a nova versão precisar de RBAC mais fino, isto é limitação a resolver agora, não depois.
4. **`Cart`/`CartItem` no schema mas fluxo real em Redis** — schema drift potencial; decidir se essas tabelas continuam existindo "mortas" ou se há algum código legado ainda a escrever nelas.
5. **`ProductVariant.sku` e `Order.orderNumber` são `@unique` globais** — geração via sequência (`sku_sequences`, `orders_display_seq`) é `SELECT ... FOR UPDATE`/`ON CONFLICT`, correta para concorrência. Prefixo do número de pedido: **resolvido**, ver §4.

---

## 3. Migrations vs. SQL solto — estado de "fidelidade"

`prisma/migrations/` só tem **5 migrations formais** (todas recentes, incrementais):
```
20260526_make_customer_name_optional
20260603_orders_display_sequence
20260605_product_display_order
20260613_add_presale
20260620_add_guest_checkout
```
Isto confirma que o schema base **não foi criado via `prisma migrate`** — foi construído/alterado manualmente ao longo do tempo. Evidência: 6 arquivos `.sql` soltos na raiz do repo, fora de qualquer migration:

| Arquivo | Conteúdo provável (pelo nome) |
|---|---|
| `SQL_NEWSLETTER_MIGRATION.sql` | Criação de `newsletter_subscriptions` |
| `SQL_STRIPE_MIGRATION.sql` | Colunas/tabelas relacionadas a Stripe em `payments` |
| `highlights_setup.sql` | Provável setup de destaques/homepage |
| `offers_promotions_setup.sql` | Setup inicial de `promotions`/`promotion_targets` |
| `rankings_schema_migration.sql` | `product_rankings` |
| `recommendations_schema_migration.sql` | `product_co_occurrences`, `product_views` |

Mais `prisma/seed/*.sql` (17 arquivos) — mistura de seed de dados (categorias, atributos) com o que parecem ser **DDL de setup** (`audit_triggers.sql`, `sku_setup.sql`, `refresh_tokens_setup.sql`, `supabase_auth_webhook.sql`) — ou seja, parte do schema real só existe como script solto, não como migration versionada nem 100% refletida no `schema.prisma` atual (ex.: triggers de auditoria mencionados em `BACKEND_BUSINESS_RULES.md` §13 não aparecem no `schema.prisma`, que é gerido pelo Prisma só ao nível de tabelas/colunas).

**Implicação prática para "ter tudo fiel em SQL antes de rodar manualmente"**: hoje não existe um único SQL "fonte da verdade" que reconstrua o banco do zero. Para a nova versão, provavelmente vale gerar um dump consolidado (`prisma migrate diff` contra banco vazio, ou `pg_dump --schema-only` do banco atual) e comparar com `schema.prisma` + os soltos, para garantir que nada ficou só "na cabeça de quem rodou manualmente".

---

## 4. Referências à marca antiga ("Doja Paris") que afetam dados/lógica, não só texto

Já resolvido: `zando` → `stockzy` (package.json, otel, health-check, Postman).

**Ainda pendente** — e mais crítico que só naming, porque toca lógica/formatos de dados:

| Local | O quê | Por que importa para a "nova versão" |
|---|---|---|
| `src/modules/orders/orders.service.ts:908` | ~~`` `DJ-${...padStart(8,'0')}` ``~~ → `` `STKZ-${...padStart(8,'0')}` `` | **Resolvido** — prefixo trocado para `STKZ-` (ver `ANALISE_ORDER_NUMBER_PREFIX.md`). Pedidos já existentes com `DJ-` foram mantidos como estão (histórico, já comunicados ao cliente). |
| `src/main.ts:40`, `customers.service.ts:1534`, `notifications.service.ts:92,95` | Fallback hardcoded `https://dojaparis.com`, `support@dojaparis.com`, `teams@dojaparis.com` | Se `FRONTEND_URL`/`INTERNAL_NOTIFY_EMAIL` não estiverem no `.env` da nova base, o sistema **volta silenciosamente para o domínio/email do projeto antigo** (links em emails, CORS fallback). |
| 62 templates `.hbs` (`pt/fr/en/es` × 15+ eventos) | Nome "Doja Paris" em título, alt text, rodapé | Todo email enviado hoje sai com marca antiga. |
| Todos os templates | `img src="https://lpowjerychcsqrtodvoh.supabase.co/.../logo.png"` | **Logo carregado do bucket Supabase do projeto antigo.** Se esse projeto Supabase for desligado/perder acesso público, todo email quebra a imagem. Precisa subir o logo novo no Supabase da nova base e trocar a URL. |
| `receipt.service.ts` (PDF de recibo) | Rodapé "Doja Paris · support@dojaparis.com" em 4 idiomas | Recibo baixado pelo cliente mostra marca errada. |
| `prisma/seed/doja_fashion_categories.sql`, `moda_calcados_extras.sql` | Seed de categorias de moda/calçados nomeado por marca | Confirmar se essas categorias fazem sentido para o novo produto ou são só dados de exemplo a descartar. |

---

## 5. Arquivos fora de lugar na raiz (não são código nem SQL fiel)

Não afetam lógica, mas poluem o "estado fiel" do repo:
- `logs.1780127220996.json` (120KB, dump de log)
- `~$attribute_options.xlsx`, `~$categories.xlsx`, `~$category_attributes.xlsx` (lock files do Excel — nunca deveriam ir pro git)
- `ShirtsampleInsertProductjson.json`, `ShirtsampleInsertProductjsonRascunho.json` (dados de exemplo/rascunho)
- `.DS_Store` em vários diretórios

---

## 6. Testes

Cobertura mínima: `test/app.e2e-spec.ts` (smoke test) + `src/app.controller.spec.ts`. **Nenhum módulo de domínio (orders, payments, products, promotions) tem testes.** Toda a lógica de negócio complexa documentada em `BACKEND_BUSINESS_RULES.md` (locking anti-oversell, transições de status, cálculo de promoção/shipping) hoje só é validada manualmente. Relevante saber antes de mexer em regras na nova versão — sem rede de segurança automatizada.

---

## 7. Regras de negócio — já documentadas

`BACKEND_BUSINESS_RULES.md` cobre em detalhe (13 secções): auth admin/cliente, catálogo/filtros/SKU, carrinho (Redis), checkout (autenticado + guest), pagamento (COD + Stripe + webhook), ciclo de vida do pedido (máquina de estados), inventário (locking `FOR UPDATE`, presale), conta do cliente, promoções, shipping, notificações, auditoria. Não repito aqui — é a referência a usar quando formos alterar cada fluxo.

Pontos que esse documento já sinaliza como específicos deste negócio (a confirmar se continuam válidos na nova versão):
- Moeda default `AOA`, cidade local de shipping `Luanda`
- Não há merge automático de carrinho guest→autenticado
- Presale é um sistema paralelo ao estoque normal (não reserva `reservedQuantity`, só conta contra `presaleLimit`)
- Apenas 1 promoção por pedido (a de maior prioridade/desconto)

---

## 8. Resumo — o que precisa de decisão antes de "rodar na base"

1. ~~Escolher o novo prefixo de número de pedido~~ — **feito**, `STKZ-` (ver `ANALISE_ORDER_NUMBER_PREFIX.md`)
2. Definir `FRONTEND_URL` / `INTERNAL_NOTIFY_EMAIL` reais no `.env` novo (não depender dos fallbacks)
3. Novo logo + assets de email hospedados no Supabase da nova base (trocar URL fixa nos 62 templates)
4. Rebrand dos templates `.hbs` e do `receipt.service.ts` (texto "Doja Paris")
5. Decidir se `Cart`/`CartItem` (tabelas) continuam ou são removidas, já que o carrinho real é Redis
6. Consolidar os `.sql` soltos + `prisma/seed/*setup*.sql` num conjunto único e versionado (migrations formais), antes de rodar manualmente na base nova
7. Confirmar se moeda/locale/mercado (AOA, Luanda, pt/fr/en/es) continuam os mesmos ou mudam com o novo projeto
8. Limpar arquivos soltos da raiz (logs, lock files do Excel, jsons de exemplo)

---

## 9. Próximos passos

Aguardando os arquivos/áreas que você quer atualizar para entrarmos fluxo a fluxo.
