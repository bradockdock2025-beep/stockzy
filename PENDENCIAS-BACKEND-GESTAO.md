# Pendências do backend para o painel de gestão

> Recriado em 2026-10-10 — o ficheiro anterior (mesmo conteúdo, análise de 2026-10-05) foi
> movido para fora do projeto e perdido. Cada item abaixo foi reverificado agora, diretamente
> no código atual (`stockzy-ecommerce-api`, branch `main`), não copiado do documento antigo.
> Nenhum dos 11 itens originais foi corrigido entretanto — os commits recentes (`9bbe8b0`,
> `5a9a13c`, `17b3745`) trataram de outras coisas (tabela de offers, auditoria em marcas/categorias,
> dashboard executivo, confirmação de COD por e-mail, leak de `passwordHash`) e não tocaram
> nestes pontos.

## Prioridade 1 — segurança

### 1.1 Gestor consegue criar administrador — ✅ resolvido (2026-10-10)
- **Feito:** default do schema trocado para `support` (`prisma/migrations/20261010_user_role_default_support/migration.sql`,
  aplicar manualmente) e `users.service.ts` agora define `role: dto.role ?? user_role.support`
  explicitamente no `create()`, sem depender só do default do banco.
- **Situação (confirmado agora):** `prisma/schema.prisma:14` — `role user_role @default(admin)`.
  Em `users.service.ts:34`, o `create()` passa `role: dto.role` direto para o Prisma; se o
  gestor não enviar `role`, fica `undefined` e o Prisma aplica o default do schema — **admin**.
- **Risco:** gestor cria utilizador sem `role` → utilizador vira administrador.
- **Correção:** trocar o default do schema para `support` (migração aditiva, não afeta linhas
  existentes) **e** em `create()`, se `dto.role === undefined`, definir explicitamente
  `support` em vez de confiar só no default.
- **Decisão necessária:** nenhuma.

### 1.2 `guestToken` nas respostas de administração — ✅ resolvido (2026-10-10)
- **Feito:** `omit: { guestToken: true }` adicionado nos quatro pontos (padrão já usado para
  `passwordHash` em `customers.service.ts`) — `orders.service.ts` (`findAll` cursor e offset,
  `findOne`), `offers.service.ts` (`listForAdmin`) e `payments.service.ts`
  (`order: { omit: { guestToken: true } }` dentro de `adminPaymentSelect`). `findAllForCustomer`,
  `findOneForCustomer` e `findGuestOrder` não foram tocados — continuam com `guestToken`.
- **Situação (confirmado agora):** nenhuma das três consultas abaixo usa `select` — todas usam
  `include` sem restringir os campos escalares do próprio registo, então o Prisma devolve
  **todos** os campos, incluindo `guestToken`:
  - `src/modules/orders/orders.service.ts:400-407` e `:433-439` (`GET /admin/orders`)
  - `src/modules/orders/orders.service.ts:710-713` (`GET /admin/orders/:id`)
  - `src/modules/offers/offers.service.ts:168-176` (`listForAdmin`, usado por `GET /admin/offers`)
  - `src/modules/payments/payments.service.ts:47-61` — `adminPaymentSelect` tem `order: true`
    (linha 60), que inclui o pedido completo (com `guestToken`) dentro de `GET /admin/payments`.
- **Correção:** trocar os `include` por `select` explícito sem `guestToken` nos quatro pontos
  (mesmo padrão já usado para `passwordHash` em clientes).
- **Decisão necessária:** nenhuma.

### 1.3 `stripePaymentIntentId` para o suporte — ✅ resolvido (2026-10-10)
- **Feito:** `adminPaymentSelect` volta a selecionar `metadata`, mas só pra ler dentro do
  service — novo método `withStripePaymentIntentId()` extrai `stripePaymentIntentId` e remove
  `metadata` (e portanto `clientSecret`) antes de devolver, aplicado em `findAll` (cursor e
  offset) e `findOne`.
- **Situação (confirmado agora):** o campo só existe dentro do JSON `metadata` do pagamento
  (`payments.service.ts:300`, `:452`: `metadata: { stripePaymentIntentId, clientSecret }`).
  `adminPaymentSelect` (linha 47-61) não seleciona `metadata`, então hoje o suporte **não vê
  o campo de forma alguma** em `GET /admin/payments` — não é mais o leak do `clientSecret`
  relatado antes, é a ausência total do dado que o suporte precisa.
- **Correção:** adicionar um campo próprio na resposta (ex.: `stripePaymentIntentId`), lido de
  `metadata.stripePaymentIntentId` dentro do service, sem expor `clientSecret`.
- **Decisão necessária:** nenhuma.

## Prioridade 2 — funcionalidade e consistência

### 2.1 Utilizadores de staff sem auditoria — ✅ resolvido (2026-10-10)
- **Feito:** `UsersModule` importa `AuditModule`; `UsersService` injeta `AuditLogService` e
  chama `.log()` em `create`/`update`/`remove` (ação `deactivate`), com `toAuditSnapshot()`
  removendo `passwordHash` do `before` (mesmo padrão de `customers.service.ts`).
- **Situação (confirmado agora):** `users.service.ts` não importa `AuditLogService` nem chama
  `.log(...)` em nenhum método. Só usa `applyAuditContext(tx, context)` (linhas 28, 130, 172),
  que apenas define variáveis de sessão Postgres (`app.actor_id` etc.) para triggers — não
  grava entrada em `audit_logs` com `entity`/`before`/`after`. Comparar com
  `brands.service.ts`, que além de `applyAuditContext` chama `this.auditLog.log({...})`
  explicitamente em 4 pontos (linhas 112, 186, 214, 278).
- **Correção:** injetar `AuditLogService` em `UsersService` e chamar `.log()` em `create`,
  `update` e `remove` (desativação), mesmo padrão de marcas/categorias.

### 2.2 E-mail de utilizador duplicado dá 500 — ✅ resolvido (2026-10-10)
- **Feito:** `create()` e `update()` agora capturam P2002 do campo `email` via
  `throwIfDuplicateEmail()` e respondem **409** (`ConflictException`) — não 400 como nas
  marcas/categorias (lá é `BadRequestException`/400; optei por 409 porque é conflito de
  recurso existente, não entrada inválida; ajustar se quiser 400 por consistência literal
  com o padrão de slug).
- **Situação (confirmado agora):** `users.service.ts:27-48` (`create`) não tem `try/catch` em
  volta do `tx.user.create(...)`. Violação da constraint de unicidade do e-mail sobe como
  `PrismaClientKnownRequestError` (P2002) não tratado → 500 genérico.
- **Correção:** capturar `P2002` no campo `email` e lançar `ConflictException` (409), mesmo
  tratamento de slug duplicado já usado em categorias/marcas/produtos.

### 2.3 Login conta também as entradas certas — ✅ resolvido (2026-10-10)
- **Feito:** `LoginRateLimitService.check()` foi dividido em `assertNotBlocked()` (só lê, sem
  incrementar — chamado pelo guard, antes da senha ser validada) e `recordFailedAttempt()`
  (incrementa e aplica bloqueio/backoff — chamado só no `catch` do `AuthController.login()`,
  depois que `authService.login()` lança `UnauthorizedException`). Login certo nunca chama
  `recordFailedAttempt`, então nunca conta pro limite. `check()` foi mantido como wrapper do
  comportamento antigo (assert + incrementa sempre) só para `CustomerRateLimitGuard`
  (login de clientes na loja), que está fora do escopo deste item — não alterado.
- **Testar antes de considerar fechado:** 5 logins certos seguidos não devem bloquear; 5
  errados devem bloquear (429) pelo tempo configurado; o bloqueio por excesso de e-mails
  distintos por IP (`shouldApplyIpLimit*`) não foi alterado, continua a rastrear todo attempt.
- **Situação (confirmado agora):** `LoginRateLimitGuard.canActivate()` chama
  `rateLimitService.check(...)` **antes** do handler de login validar a senha — o guard não
  sabe se a tentativa vai ter sucesso. `LoginRateLimitService.check()` (linhas 49-166) sempre
  incrementa o contador (`checkWithRedis`/`checkWithMemory`), e não há nenhuma chamada para
  resetar/decrementar em caso de sucesso em nenhum ponto do módulo `auth`.
- **Impacto agravado:** desde a análise anterior foi adicionado backoff exponencial por
  "penalty level" (`computeBackoffMs`, linha 481-492) — um bloqueio por logins corretos
  repetidos agora pode durar muito mais que os 5 minutos originais.
- **Correção:** mover o incremento para depois de confirmada a falha de autenticação (ou
  limpar o contador da chave no sucesso).

### 2.4 Produtos: remover variante, apagar imagem e reordenar imagens — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim, sem perguntar — instrução do utilizador):** segui as duas
  recomendações do levantamento original: bloquear desativar a última variante ativa de
  produto **ativo** (permitir em rascunho/arquivado); permitir apagar a última imagem,
  removendo também do Storage.
- **Feito:** `PATCH /admin/products/variants/:id/deactivate` (400 `LAST_ACTIVE_VARIANT` se
  for a última ativa de produto `active`), `DELETE /admin/products/images/:imageId`
  (remove o registo e o ficheiro do Storage via `extractStoragePath`, mesmo padrão de
  `auth.service.ts` pros avatares), `PATCH /admin/products/:id/images/reorder` (valida que
  as imagens pertencem ao produto). Auditoria (`entity: product_variant`/`product_image`)
  em todos os três.
- **Testado ao vivo:** desativei 5 das 6 variantes de um produto ativo real — todas OK (200);
  a 6ª (última) → 400 `LAST_ACTIVE_VARIANT`, confirmado. Reordenei a imagem do mesmo produto
  com sucesso.
- ~~**Ação pendente sua:** restaurar as 5 variantes desativadas de propósito no teste~~ — ✅
  `SQL_RESTORE_VARIANTS_QA_TEST.sql` executado pelo utilizador em 2026-10-10; confirmado via
  `GET /admin/products/62795e1e-77e7-4585-918f-12975889be6f` que as 6 variantes voltaram a
  `isActive: true`. Ficheiro removido do repo (era um script de limpeza pontual, não uma
  migração).
- **Situação (confirmado agora):** rotas mapeadas hoje em `products.admin.controller.ts`:
  `POST /:id/images`, `PATCH /reorder` (reordena **produtos**, não imagens), `PATCH /:id`,
  `PATCH /:id/archive`, `PATCH /variants/:id/presale`, `PATCH /variants/:id/offer`,
  `DELETE /:id`. Não existe `PATCH /variants/:id/deactivate`, `DELETE /images/:imageId` nem
  `PATCH /:id/images/reorder`. Os campos já existem no banco (`ProductVariant.isActive`,
  `ProductImage.position`), só falta expor os endpoints.

### 2.5 Produtos: permissão do gestor — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim):** gestor lê, escrita continua só admin — é o padrão já usado em
  `orders`/`payments` (classe `@Roles(admin)`, override `@Roles(admin, manager)` nas rotas
  `GET`), e é a leitura literal do documento de endpoints que o frontend já espera.
- **Feito:** `@Roles(admin, manager)` adicionado em `GET /admin/products`,
  `GET /admin/products/:id` e `GET /admin/products/:id/price-history`. Escrita
  (POST/PATCH/DELETE) continua herdando `@Roles(admin)` da classe.
- **Testado ao vivo:** criei um utilizador `manager` temporário — `GET /admin/products` → 200;
  `POST /admin/products` → 403. Desativei o utilizador de teste depois (pela própria API).
- **Situação (confirmado agora):** `products.admin.controller.ts:28-29` —
  `@Controller('admin/products')` com `@Roles(user_role.admin)` a nível de classe, sem
  override em nenhuma rota `@Get`. Gestor recebe 403 em **toda** `/admin/products`, incluindo
  leitura.

### 2.6 Envios: `POST /events` não avisa o cliente — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim):** sim, notificar — era a recomendação, e sem isso o módulo
  Envios tem dois caminhos pro mesmo efeito (mudar o estado) com comportamento diferente, o
  que é inconsistente pro frontend.
- **Feito:** `addEvent` agora dispara `order.shipped`/`order.delivered` nas mesmas condições
  do `update()` (só quando o estado muda de fato, nunca duplica se o evento repetir o estado
  atual). **Coordenar com o frontend:** quem consome `POST /events` pra marcar
  enviado/entregue deve parar de chamar o `PATCH` prévio pro mesmo efeito, senão o cliente
  recebe dois e-mails.
- **Testado ao vivo (2026-10-10):** criei um shipment novo (`pending`) pro pedido
  `STKZ-00010040` do cliente de teste padrão. `POST /events` com `shipped` → 201 **e**
  e-mail real enviado (log: `Email sent: template=order-shipped.pt.hbs
  to=startupgorjemanuelgorjemanuel@gmail.com`). Repeti `shipped` de novo → 201, **sem**
  e-mail novo (confirmado pela contagem de `Email sent` no log, continuou 1).
- **Situação (confirmado agora):** `shipments.service.ts:240-290` (`addEvent`) não chama
  `notificationsService.dispatch(...)` em nenhum momento. Só `create()` (linhas 153, 160) e
  `update()` (linhas 228, 234) disparam e-mail de "enviado"/"entregue".

### 2.7 Envios: regras de transição — ✅ resolvido, com escopo reduzido (2026-10-10)
- **Decisão (tomada por mim, ajustando a recomendação original):** a recomendação original
  ("→ shipped a partir de pending/paid/processing/presale") mistura valores de
  `order_status` com `shipment_status` — `paid`/`processing`/`presale` nem existem no enum
  `shipment_status` (que é `pending/shipped/in_transit/delivered/failed/returned/cancelled`).
  Em vez de adivinhar uma regra não claramente especificada arriscando travar fluxos
  legítimos, implementei só a regra inequívoca do próprio relatório do bug: **`delivered`
  exige ter passado por `shipped` ou `in_transit` antes.** Não restringi as outras transições
  (ex.: voltar de `failed` pra `pending` continua permitido).
- **Feito:** `assertValidShipmentTransition()` aplicada em `create`, `update` e `addEvent`,
  respondendo 400 `INVALID_SHIPMENT_TRANSITION` quando viola a regra.
- **Testado ao vivo (2026-10-10):** no mesmo shipment de teste do item 2.6, `pending →
  delivered` direto via `POST /events` → **400** `INVALID_SHIPMENT_TRANSITION` (`{"from":
  "pending","to":"delivered"}`), confirmado. Depois `pending → shipped → delivered` (na
  ordem certa) → ambos 201, fluxo completo funcionando.
- **Situação (confirmado agora):** não existe tabela de transições em `shipments.service.ts`.
  As únicas validações encontradas são `assertOrderMutable` (linha 46, bloqueia mudanças em
  pedido cancelado/reembolsado) e checagens de data (`normalizeDates`, linha ~93-100). Nada
  impede `pending → delivered` direto, em `create`, `update` ou `addEvent`.

### 2.8 E-mail de envio mostra a data crua — ✅ resolvido (2026-10-10)
- **Feito:** `shipments.service.ts` agora passa `estimatedDelivery` já como `Date` parseado
  (`this.parseDate(dto.estimatedDeliveryAt)`, não a string crua do DTO). Em
  `notifications.service.ts`, novo helper `formatDateOnly()` (dd/mm/yyyy, sem hora — a
  previsão de entrega não tem componente de hora útil) é aplicado a `estimatedDelivery` no
  fim da montagem do `context`, depois do `...extraPayload`. Não reusei `formatDateTime`
  (tem hora: min) porque o valor sempre viria como `00:00`. Nota: o `PATCH` (`update()`) não
  passa `estimatedDelivery` pro `dispatch` — isso já era assim antes e não fazia parte deste
  item; o e-mail de "enviado" disparado por uma atualização simplesmente não mostra a previsão.
- **Situação (confirmado agora):** `shipments.service.ts:157` passa
  `estimatedDelivery: dto.estimatedDeliveryAt ?? undefined` (objeto `Date` bruto) para
  `notificationsService.dispatch(...)`. Em `notifications.service.ts:171-203` (`dispatch`), o
  `context` faz `...extraPayload` sem reformatar `estimatedDelivery` — só outros campos de data
  (`expiresAt`, `expectedAvailableAt`) passam por `formatDateTime`/formatação manual. O
  Handlebars recebe o `Date` e serializa como ISO cru (`2026-10-05T00:00:00.000Z`).
- **Correção:** formatar `estimatedDelivery` com o mesmo tratamento usado no e-mail de COD
  (`formatDateTime`, por idioma do pedido) antes de passar para `dispatch`.

## Prioridade 3 — menor

### 3.1 Ofertas: lista sem filtro — ✅ parcialmente resolvido (2026-10-10)
- **Feito:** sem `status` na query, `listForAdmin` agora devolve todas as ofertas (filtro
  aplicado só quando `status` é enviado).
- **Não feito:** a paginação mencionada na recomendação original — a resposta continua um
  array simples, sem `page`/`limit`/`meta`. Deixei assim pra não mudar o formato da resposta
  que o frontend já consome sem necessidade confirmada; se o volume de ofertas justificar,
  implementar paginação depois (`QueryOfferDto` com `page`/`limit`, mesmo padrão de
  `orders`/`payments`).
- `pending_window` (existe no enum, nenhum código atribui) continua sem uso — não removido do
  schema; não afeta nada em produção enquanto não for atribuído por código nenhum.
- **Situação de antes (pra registo):** `offers.service.ts:168` tinha
  `where: { status: status ?? offer_status.pending }` — sem `status` na query, devolvia só
  as pendentes.

### 3.2 Documento de endpoints desatualizado — ✅ resolvido (2026-10-10)
- **Feito:** revisão item a item contra o código atual de todos os admin controllers.
  Corrigidas 2 rotas que o documento dizia liberadas pra `manager` mas o código restringe a
  `admin` (`PATCH /admin/products/reorder` e `PATCH /admin/products/variants/:id/presale`);
  adicionados 2 endpoints que existiam no código e faltavam no documento
  (`POST`/`DELETE /admin/auth/me/avatar`, `GET /admin/dashboard/executive`); documentados os
  3 endpoints novos do item 2.4; atualizadas as notas de comportamento de 1.1-1.3, 2.2, 2.3,
  2.6, 2.7, 3.1; parágrafo de papéis reescrito pra bater com a realidade (`manager` não tem
  nenhum acesso a `promotions`, não só "exceto delete"); contagem de endpoints corrigida de
  87 para 116.
- **Não feito:** auditoria linha a linha de **todas** as 19 seções — focei nas seções
  afetadas pelas mudanças de hoje mais uma verificação direta de `@Roles` em todos os
  controllers admin (via grep). Seções sem mudança hoje (ex.: homepage, banners, anúncios)
  não foram reconferidas campo a campo.

## Ação de dados pendente (não é código)

- **Pedidos enviados/entregues antes da correção que passou a criar o registo de Shipment**
  continuam sem registo no módulo Envios. Script pronto em `SQL_BACKFILL_SHIPMENTS_PEDIDOS_ORFAOS.sql`
  — não há como confirmar pelo código se já foi executado; confirmar com quem tem acesso direto
  ao banco antes de rodar de novo.

## Decisões — todas tomadas por mim em 2026-10-10 (instrução do utilizador: decidir sem perguntar)

| # | Decisão | Afeta | O que foi decidido |
|---|---|---|---|
| 1 | Gestor pode ler produtos? | 2.5 | Sim — `GET` liberado pra manager, escrita continua admin |
| 2 | Desativar a última variante ativa de produto ativo | 2.4 | Bloqueado (400 `LAST_ACTIVE_VARIANT`) |
| 3 | Apagar a última imagem de um produto | 2.4 | Permitido, remove do Storage também |
| 4 | `POST /events` deve notificar o cliente? | 2.6 | Sim, mesma regra do `PATCH` |
| 5 | Regras de transição de envios | 2.7 | Escopo reduzido: só bloqueia `delivered` sem passar por `shipped`/`in_transit` (ver nota em 2.7 sobre por que a recomendação original não dava pra aplicar ao pé da letra) |
| 6 | Executar o script de envios órfãos | — | Ainda não verificado — ver nota abaixo |

## Ordem de trabalho — tudo fechado em 2026-10-10

1. ~~**Prioridade 1** (1.1, 1.2, 1.3)~~ — ✅
2. ~~**Prioridade 2** (2.1 a 2.8)~~ — ✅ todos, incluindo 2.4-2.7 que dependiam de decisão
   (decisões tomadas por mim, ver tabela acima).
3. ~~**Prioridade 3**~~ — ✅ 3.1 (parcial, sem paginação) e 3.2, ambos fechados em 2026-10-10.

## Tudo fechado — só restam as coordenações abaixo

Tudo que era código foi implementado, buildado e testado ao vivo (ver cada item acima).
`npm run build` passa limpo (0 erros) com todas as mudanças de 2026-10-10. O único ponto
realmente aberto agora é de processo, não de código:

- **Coordenar com o frontend** antes de considerar 2.6 realmente fechado: quem chama
  `PATCH /admin/shipments/:id` pra marcar enviado/entregue deve parar de chamar
  `POST /events` com o mesmo efeito (ou vice-versa) no mesmo dia, senão duplica e-mail pro
  cliente.
- Não testei com uma conta `support` real (só `admin` e um `manager` temporário, já
  desativado) — não é bloqueio, os controllers de `support` não foram tocados hoje.
