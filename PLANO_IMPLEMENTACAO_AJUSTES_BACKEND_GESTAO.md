# Plano de implementação — ajustes de backend pra consistência de gestão

> Continuação de [`PLANO_APP_ADMIN_GESTAO.md`](./PLANO_APP_ADMIN_GESTAO.md), que levanta o
> panorama geral. Este arquivo é o plano de execução: lista fechada, em ordem de
> prioridade, de cada ajuste/atualização necessário no backend, com evidência concreta (não
> suposição), onde mexer, e critério de "pronto". Cada item foi confirmado lendo o código
> real — inclui uma segunda verificação nos achados de auditoria, feita por um caminho de
> busca diferente do primeiro, pra não reportar falso positivo.

---

## P0 — Bloqueiam consistência de gestão, baixo esforço, alto impacto

### P0.1 — Trilha de auditoria ausente em 7 módulos com 26 endpoints de escrita

**Evidência:** todo controller `admin/*` com endpoint de escrita foi varrido por dois
métodos independentes — presença de `buildAuditContext` no controller, e presença de
`AuditLogService`/`auditLog.` no service — com o mesmo resultado nos dois:

| Módulo | Endpoints de escrita | Auditoria hoje |
|---|---|---|
| `admin/homepage` | 9 (hero, tiles, social) | ❌ nenhuma |
| `admin/banners` | 5 | ❌ nenhuma |
| `admin/announcements` | 4 | ❌ nenhuma |
| `admin/promotions` | 3 | ❌ nenhuma |
| `admin/customers` | 2 (patch, deactivate) | ❌ nenhuma |
| `admin/offers` | 2 (accept, reject) | ❌ nenhuma |
| `admin/newsletter` | 1 | ❌ nenhuma |

Comparar com o que já funciona corretamente: `brands`, `categories`, `facets`, `products`,
`shipments`, `orders`, `users` — todos chamam `buildAuditContext`/`AuditLogService` nas
mutações e aparecem em `GET /admin/audit-logs`.

**Por que isso bloqueia gestão de verdade:** hoje ninguém consegue responder "quem mudou o
hero da home", "quem desativou este cliente", "quem aceitou esta oferta", "quem criou esta
promoção" — pros 7 módulos acima, a resposta é sempre "não sabemos". Num app de gestão com
múltiplos usuários de staff, isso é a primeira coisa que gera desconfiança/disputa interna.

**Como resolver:** seguir exatamente o padrão já usado em `shipments.admin.controller.ts`
(mais simples de copiar): injetar `AuditContext` via `buildAuditContext(req)` no controller,
passar como parâmetro extra pro método do service, e no service chamar
`this.auditLog.record(...)` (mesma assinatura já usada em `products.service.ts`/
`orders.service.ts`) depois de cada create/update/delete/patch.

**Critério de pronto:** os 26 endpoints listados aparecem em `GET /admin/audit-logs` depois
de exercitados.

**Esforço:** baixo — é replicar um padrão já existente 7 vezes, não desenhar nada novo.

---

### P0.2 — Papel `support` existe no banco mas não abre nenhuma porta

**Evidência:** `enum user_role { admin, manager, support }` no schema — busquei
`@Roles(` em todo `admin/*` controller (18 controllers) e **nenhum** inclui
`user_role.support`. Um usuário criado com esse papel loga com sucesso
(`POST /admin/auth/login`) e recebe `403 FORBIDDEN` em toda rota admin que existe.

**Por que isso bloqueia gestão:** se o plano é ter "cada perfil com seu nível de acesso",
um papel que não acessa nada não é um nível de acesso — é um bug esperando pra acontecer
(alguém cria um usuário de suporte achando que ele vai funcionar, e não funciona).

**Como resolver:** decisão de negócio primeiro (proposta na seção 4 de
`PLANO_APP_ADMIN_GESTAO.md`: leitura de pedidos e clientes, sem escrita em catálogo/
promoções). Depois, tecnicamente, dois passos:

1. Nos controllers `admin/orders` e `admin/customers`, mover `@Roles()` de nível de classe
   pra nível de método — hoje `@Roles(admin, manager)` está uma vez no topo da classe e
   vale pra todo método; precisa virar `@Roles(admin, manager, support)` nos `@Get`
   (leitura) e continuar `@Roles(admin, manager)` nos `@Patch`/`@Delete` (escrita).
2. Repetir o mesmo em qualquer outro módulo que a decisão de negócio incluir.

**Critério de pronto:** um usuário `support` consegue `GET /admin/orders` e
`GET /admin/customers`, e recebe `403` em qualquer tentativa de escrita em qualquer módulo.

**Esforço:** baixo — é mover decorator de lugar, não criar mecanismo novo. **Depende de**
uma decisão de escopo (o que "support" pode ver) antes de codar.

---

## P1 — Necessários pro app de gestão funcionar de forma completa

### P1.1 — Sem endpoint de dashboard/KPI alcançável pelo login normal de staff

**Evidência:** `OrdersService.getSalesSummary()` já existe e funciona
(`src/modules/orders/orders.service.ts`), mas o único controller que o expõe é
`orders.reports.controller.ts` (`admin/reports/sales`), que é `@Public()` +
`AdminApiKeyGuard` — ou seja, **não usa o JWT de staff**, usa uma API key estática separada.
Nenhum controller protegido por `RolesGuard` (o mecanismo que o app de gestão vai usar
depois do login) expõe esse dado.

**Por que isso bloqueia gestão:** um app de gestão sem tela inicial de KPIs (vendas,
pedidos pendentes, estoque baixo) força o usuário a navegar módulo por módulo pra montar
um panorama que deveria estar pronto no login. E a rota que já calcula isso está tecnicamente
inacessível pro fluxo de autenticação que o app vai usar.

**Como resolver:** criar um endpoint novo protegido por `RolesGuard` normal — duas opções:

- (a) mais rápido: adicionar `GET /admin/orders/dashboard` (ou `/summary`) dentro do
  `orders.controller.ts` já existente, reaproveitando `getSalesSummary()` direto.
- (b) mais correto a médio prazo: criar `admin/dashboard` como módulo próprio, agregando
  não só vendas (`getSalesSummary()`) mas também estoque baixo (`Inventory.stockQuantity`
  perto de zero), pedidos aguardando ação, e assinantes/clientes novos — dados que hoje
  vivem espalhados em 3-4 services diferentes.

**Critério de pronto:** `GET /admin/<algo>` autenticado com JWT de staff (`admin`/`manager`)
devolve pelo menos vendas recentes + pedidos pendentes, sem precisar de `x-admin-key`.

**Esforço:** médio — opção (a) é pequena, opção (b) exige agregar 3-4 fontes de dado.

---

### P1.2 — Controle de acesso é "tudo ou nada" por controller

**Evidência:** todos os 18 controllers `admin/*` aplicam `@Roles(...)` uma vez, na classe
inteira — não há um único caso de `@Roles()` no nível de método hoje. Isso significa que
`manager`, em qualquer módulo onde tem acesso, tem acesso a **toda** ação daquele módulo,
incluindo `DELETE`.

**Por que isso bloqueia gestão:** o pedido original foi "cada perfil terá seu nível de
acesso" — hoje só existe granularidade de *módulo*, não de *ação dentro do módulo*. Um
`manager` que precisa editar produto também pode apagar produto, sem opção de restringir
só a isso.

**Como resolver:** é a mesma técnica do item P0.2 (mover `@Roles()` de classe pra método),
aplicada de forma mais ampla — não como mecanismo novo, só reorganizando decorators já
existentes. Sugestão de recorte por módulo (ajustável):

| Módulo | Leitura (`GET`) | Escrita (`POST`/`PATCH`) | Delete |
|---|---|---|---|
| `admin/products` | `admin`, `manager` | `admin`, `manager` | `admin` só |
| `admin/orders` | `admin`, `manager`, `support` | `admin`, `manager` | `admin` só |
| `admin/customers` | `admin`, `manager`, `support` | `admin`, `manager` | — (não existe delete hoje) |
| `admin/promotions` | `admin`, `manager` | `admin` só | `admin` só |
| `admin/users` | `admin`, `manager` | `admin` só | `admin` só |

**Não fazer isso em todo módulo de uma vez** — priorizar os que o negócio realmente precisa
de perfil diferenciado (provavelmente `products`, `orders`, `customers`, `promotions`,
`users` — os 5 da tabela). Módulos de conteúdo/marketing (`homepage`, `banners`,
`announcements`) provavelmente não precisam dessa granularidade — `admin`+`manager` com
acesso igual já é suficiente ali.

**Critério de pronto:** os 5 módulos da tabela respeitam o recorte leitura/escrita/delete
por role, validado com um usuário de cada papel.

**Esforço:** baixo-médio — mecanicamente simples, mas exige revisar cada endpoint um a um
pra não errar o recorte.

---

## P2 — Consistência/documentação, não bloqueia uso, vale fazer depois

### P2.1 — Dois padrões de paginação coexistem, sem se anunciarem no shape da resposta

**Evidência:** comparando o `findAll` de 6 services admin lado a lado:

- **Cursor-first com fallback pra página** (`orders`, `customers`, `shipments`,
  `payments`, `promotions`): se `query.cursor` vier, responde
  `{ data, meta: { limit, nextCursor } }`; senão, cai num modo paginado por `page`/`total`.
- **Só paginação por página** (`brands`, e provavelmente `categories`/`facets`, mesmo
  padrão mais simples): sempre `{ data, meta: { total, page, limit, totalPages } }`, sem
  suporte a cursor.

**Isso não é um bug** — os dois padrões são internamente consistentes e bem implementados
onde são usados (cursor faz sentido pra tabelas grandes/scroll infinito como pedidos e
pagamentos; paginação por página faz sentido pra listas de referência pequenas como
marcas). O problema é que **o shape da resposta não diz qual dos dois modos está ativo** —
quem constrói uma tabela genérica no app de gestão precisa saber de antemão, por fora da
API, qual convenção cada endpoint usa.

**Como resolver (baixo risco, não é refatoração):** não unificar os dois modos — só tornar
o modo ativo explícito na resposta, ex. adicionar `meta.mode: 'cursor' | 'offset'` em
ambos os formatos. É uma mudança aditiva (não quebra clientes existentes que já leem
`total`/`nextCursor` diretamente).

**Critério de pronto:** toda resposta de lista `admin/*` inclui `meta.mode`.

**Esforço:** baixo, mas é 6+ arquivos pra tocar (um por service).

---

### P2.2 — CORS do novo app (configuração, não código)

**Evidência:** `src/main.ts` já lê `ALLOWED_ORIGINS` do `.env` (lista separada por
vírgula) e libera qualquer `localhost:<porta>` automaticamente fora de produção — nenhuma
mudança de código é necessária pra desenvolver o app novo localmente.

**Como resolver:** só em produção, quando o domínio do app de gestão for definido, adicionar
esse domínio em `ALLOWED_ORIGINS`.

**Esforço:** trivial — 1 linha de configuração, não é tarefa de desenvolvimento.

---

## Ordem de execução recomendada

```
1. P0.2 (decisão de escopo do "support")  → desbloqueia P1.2 usar o mesmo padrão
2. P0.1 (auditoria nos 7 módulos)         → independente, pode rodar em paralelo com P0.2
3. P1.2 (granularidade leitura/escrita)   → reaproveita a técnica já usada em P0.2
4. P1.1 (dashboard)                       → maior escopo, fazer depois do controle de acesso estar sólido
5. P2.1 (meta.mode explícito)             → polimento, sem pressa
6. P2.2 (CORS)                            → só quando o domínio de produção existir
```

Nada foi alterado no backend — isso é só o plano de execução, como pedido.
