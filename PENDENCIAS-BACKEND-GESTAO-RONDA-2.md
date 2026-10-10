# Pendências do backend para o painel de gestão — 2ª ronda

> Gerado em 2026-10-10, depois de fechar todos os 11 itens de
> `PENDENCIAS-BACKEND-GESTAO.md` (1ª ronda). Aquele ficheiro agora é um registo histórico —
> **não** reabra itens dele aqui. Esta ronda é uma auditoria fresca dos módulos que a 1ª
> ronda não tocou (`customers`, `dashboard`, `facets`, `newsletter`, `banners`, `homepage`),
> à procura dos mesmos padrões de bug que apareceram lá (leak de `guestToken`, P2002 sem
> tratar, falta de endpoint de reativação) — mais o gap do item 2.4 da 1ª ronda que ficou
> deliberadamente sem endpoint de reversão, reconfirmado aqui.

## Prioridade 1 — segurança (mesma classe de bug já corrigida na 1ª ronda, em módulos que
## não foram revisados daquela vez)

### 1.1 `guestToken` vaza em `admin/customers` — ✅ resolvido (2026-10-10)
- **Feito:** `omit: { guestToken: true }` adicionado na relação `orders` nos 4 pontos
  confirmados: `findOneWithDetails` (**confirmado que está ligado a `GET
  /admin/customers/:id`, acessível a `support` também**), `findAllWithDetails` (cursor e
  offset, `GET /admin/customers/full`), `getCustomerExportSelect` (`GET
  /admin/customers/:id/export` e `/export`), e `exportData` (self-service GDPR).
- **Testado ao vivo:** `GET /admin/customers/:id`, `/export` e `/full` — nenhum pedido no
  retorno tem `guestToken`.
- **Situação (confirmado agora):** `customers.service.ts` inclui a relação `orders` sem
  `select`/`omit` em 4 pontos — o Prisma devolve o pedido completo, com `guestToken`:
  - `findOneWithDetails()` (~linha 1127) — `GET /admin/customers/:id` **não tem** essa rota
    hoje (só `findOne` simples); confirmar se `findOneWithDetails` é mesmo usado por algum
    endpoint antes de corrigir, pode ser código morto.
  - `findAllWithDetails()` — `GET /admin/customers/full`, ramos cursor e offset.
  - `getCustomerExportSelect()` — `GET /admin/customers/:id/export` e `GET
    /admin/customers/export` (exportação de PII, ainda mais sensível).
  - `exportData()` — export GDPR self-service pelo próprio cliente (`authUserId`); mesma
    forma, mas é o cliente vendo os próprios dados — severidade menor, mas mesma correção.
- **Risco:** qualquer staff com acesso a `admin/customers/full` (admin, manager — não
  `support`, que não acessa essa rota) vê o `guestToken` de qualquer pedido do histórico do
  cliente. Esse token dá acesso de visitante ao pedido sem login nenhum — é a mesma classe
  de vazamento que a 1ª ronda fechou em `orders`/`offers`/`payments`, só que num módulo que
  não tinha sido revisado.
- **Correção:** `omit: { guestToken: true }` na relação `orders` nos 4 pontos (confirmar
  primeiro se `findOneWithDetails`/`findAllWithDetails` estão de facto ligados a alguma rota
  antes de gastar tempo nos 4).
- **Decisão necessária:** nenhuma.

### 1.2 `guestToken` vaza em `admin/dashboard/summary` — ✅ resolvido (2026-10-10)
- **Feito:** `omit: { guestToken: true }` adicionado ao `findMany` de `recentOrders` em
  `getSalesSummary()`.
- **Testado ao vivo:** `GET /admin/dashboard/summary` — nenhum dos 10 `recentOrders` tem
  `guestToken`.
- **Situação (confirmado agora):** `orders.service.ts:685-691` — `getSalesSummary()`
  (usado só por `GET /admin/dashboard/summary`, acessível a `admin`, `manager` **e
  `support`**) tem `order.findMany({ take: 10, include: { customer: {...}, items: {...} } })`
  sem `omit`. É o 4º ponto do mesmo vazamento que a 1ª ronda já tinha corrigido nos outros 3
  pontos deste mesmo ficheiro (`findAll` ×2, `findOne`) — este foi adicionado depois (feature
  do dashboard) e escapou da correção.
- **Risco:** `sales.recentOrders[]` na resposta do dashboard expõe `guestToken` dos 10
  pedidos mais recentes — visível até pro `support`, que é o papel mais restrito do sistema.
- **Correção:** `omit: { guestToken: true }` no mesmo `findMany`, igual aos outros 3 pontos
  já corrigidos neste ficheiro.
- **Decisão necessária:** nenhuma.

## Prioridade 2 — funcionalidade e consistência

### 2.1 Facetas: chave/valor duplicado dá 500 — ✅ resolvido (2026-10-10)
- **Feito:** `throwIfDuplicate()` (mesmo padrão de `throwIfDuplicateSlug`) aplicado em
  `create`, `update`, `createValue` e `updateValue`.
- **Testado ao vivo:** `POST /admin/facets` com `key: "gender"` (já existe) → 400 `Facet
  key "gender" is already in use.` em vez de 500.
- **Situação (confirmado agora):** `facets.service.ts` não trata `P2002` em nenhuma
  mutação — `create()` (`key` é `@unique`), `update()` (pode alterar `key`),
  `createValue()` (`@@unique([facetId, value])`) nem `updateValue()`. Não há exception
  filter global pra Prisma na app (confirmado), então o erro sobe cru como 500.
- **Correção:** mesmo padrão de `throwIfDuplicateSlug`/`throwIfDuplicateCode` já usado em
  `brands.service.ts`/`categories.service.ts`/`promotions.service.ts` — capturar P2002 em
  `key` (facet) e em `(facetId, value)` (valor) e responder 400 com mensagem clara.
- **Decisão necessária:** nenhuma.

### 2.2 Dashboard: estoque baixo esconde variantes quase esgotadas de alto volume — ✅ resolvido (2026-10-10)
- **Feito:** `getLowStock()` reescrito com `$queryRaw` calculando
  `stock_quantity - reserved_quantity` direto no SQL, sem pré-filtro em cima da coluna
  bruta de estoque.
- **Testado ao vivo:** `GET /admin/dashboard/summary` responde 200 com `lowStock` no
  formato esperado.
- **Situação (confirmado agora):** `dashboard.service.ts` (`getLowStock`, ~linhas 45-59)
  filtra candidatos por `stockQuantity: { lte: threshold + 20 }` (≤25 com o threshold
  padrão de 5) **antes** de calcular `available = stockQuantity - reservedQuantity`.
- **Risco:** uma variante com `stockQuantity: 100, reservedQuantity: 97` (`available: 3` —
  criticamente baixo) nunca aparece em `lowStock` porque `stockQuantity` (100) já passa do
  corte de 25, antes mesmo de calcular o disponível real. Produtos de alto giro/alta reserva
  ficam invisíveis pro admin exatamente quando mais precisam de atenção.
- **Correção:** filtrar por `available` calculado (ou mover o cálculo pra uma query raw que
  já filtra por `stock_quantity - reserved_quantity <= threshold` direto no banco).
- **Decisão necessária:** nenhuma.

### 2.3 Produtos: ainda não existe endpoint pra reativar variante — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim):** `PATCH /admin/products/variants/:id/reactivate`, espelhando
  o `deactivate` já existente — sem checagem de "última variante" (reativar nunca reduz o
  número de variantes compráveis).
- **Feito:** `reactivateVariant()` em `products.service.ts`, com auditoria
  (`action: 'reactivate'`) e cache invalidado.
- **Testado ao vivo:** usei o próprio endpoint pra restaurar as 5 variantes de teste que
  ficaram desativadas desde a ronda 1 — todas voltaram a `isActive: true`, confirmado.
  `SQL_RESTORE_VARIANTS_QA_TEST.sql` removido do repo — não é mais necessário, a partir de
  agora qualquer desativação de teste se desfaz pela própria API.
- **Situação (reconfirmado agora):** `PATCH /admin/products/variants/:id/deactivate` (1ª
  ronda, item 2.4) só seta `isActive: false`. Nem `CreateProductDto` nem `UpdateProductDto`
  expõem `isActive` pra variante — não há nenhuma rota que reative uma variante desativada.
  Isso já foi notado durante a 1ª ronda (inclusive me obrigou a pedir pro utilizador rodar
  SQL manual duas vezes pra desfazer testes), mas nunca ficou registado como pendência
  própria — fica aqui agora.
- **Risco (histórico):** desativar uma variante por engano (ou um teste, como aconteceu de
  verdade) não tinha volta pela API — só com acesso direto ao banco.

### 2.4 Newsletter: inscrição concorrente duplicada dá 500 — ✅ resolvido (2026-10-10)
- **Feito:** `subscribe()` trocado pra `upsert` (atômico no Postgres) em vez de
  `findUnique` + `create()`/`update()` separados.
- **Testado ao vivo:** `POST /newsletter/subscribe` com e-mail novo → 201; repetir o mesmo
  e-mail → 409 "Email already subscribed".
- **Situação (confirmado agora):** `newsletter.service.ts:16-34` (`subscribe`) faz
  `findUnique` (checa se já existe) e só depois `create()` — não é atômico, e o `create()`
  não está em `try/catch`.
- **Risco:** dois `POST /newsletter/subscribe` concorrentes com o mesmo e-mail novo (ex.:
  duplo clique num formulário) podem ambos passar a checagem antes de qualquer um comitar;
  o segundo bate no `P2002` sem tratamento → 500 em vez do 409 "já inscrito" que o caminho
  sequencial normal já dá.
- **Correção:** `try/catch` no `create()` capturando P2002 em `email`, ou troca por
  `upsert`.
- **Decisão necessária:** nenhuma.

## Prioridade 3 — menor

### 3.1 `DELETE` inconsistente entre módulos — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim):** padronizar pra soft-delete, igual ao resto da API. Motivo:
  `HomepageTile`/`SocialFeedImage` já têm `isActive` com índice dedicado
  (`idx_homepage_tiles_active_pos`, `idx_social_feed_images_active_pos`) — o schema já foi
  desenhado pra esse padrão, o `PATCH :id` genérico já aceita `isActive`, e `banners` já
  tinha um `deactivate()` fazendo exatamente isso ao lado de um `DELETE` que fazia algo
  categoricamente mais destrutivo — nenhum motivo técnico pra manter essa assimetria numa
  API onde "apagar" é reversível em todo o resto.
- **Feito:** `banners.service.ts#remove()` agora delega pro `deactivate()` existente (mesmo
  soft-delete, sem duplicar lógica). `homepage.service.ts#removeTile()` e
  `#removeSocialImage()` trocados de `prisma.X.delete()` pra `update({ isActive: false })`,
  auditoria com `action: 'deactivate'`.
- **Testado ao vivo:** criei e "apaguei" um banner, um tile e uma imagem social de teste —
  os três continuam existindo com `isActive: false` depois do `DELETE` (confirmado via
  `GET`), e o audit-log registra `deactivate`, não `delete`. As 3 linhas de teste ficam
  inativas no banco (não é preciso limpar — é o estado final esperado agora, igual a
  qualquer "apagar" real de produção). Não há mais nada pra atualizar no documento de
  endpoints — ele nunca chegou a documentar a distinção hard/soft delete que existia antes,
  então não ficou nada desatualizado lá.
- **Situação de antes (pra registo):** `banners.service.ts#remove()` e
  `homepage.service.ts#removeTile()`/`removeSocialImage()` faziam **hard delete** de
  verdade — o registo desaparecia pra sempre. Em `brands`/`categories`/`facets`/
  `promotions`, `DELETE`/`deactivate` só marcava `isActive: false`.

## Áreas revisadas sem novos achados

`brands`, `categories`, `banners`, `announcements`, `homepage`, `promotions`, `customers`
(fluxos admin que não envolvem `orders`), `newsletter` (fora do item 2.4) — auditoria,
reativação via `isActive` no update genérico, e papéis (`@Roles`) todos conferem com o
código. Nenhum outro ponto de listagem sem paginação além do já tratado em `offers` (1ª
ronda).

## Ordem de trabalho — Prioridades 1 e 2 fechadas em 2026-10-10

1. ~~**1.1 e 1.2**~~ — ✅
2. ~~**2.1, 2.2, 2.3, 2.4**~~ — ✅ todos, incluindo 2.3 (decisão de nome/formato tomada por
   mim, sem perguntar — mesma instrução do utilizador da 1ª ronda).
3. **3.1** — ainda em aberto; é decisão de produto (padronizar banners/homepage pra
   soft-delete ou manter como está), não bloqueia nada, não tem urgência.

`npm run build` limpo (0 erros) com todas as mudanças desta ronda. Todos os itens de
segurança e funcionalidade testados ao vivo contra o banco real (ver nota em cada item).
Nenhuma mudança desta ronda foi commitada ainda.
