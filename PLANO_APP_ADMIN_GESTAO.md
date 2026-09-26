# Plano — App de Gestão (Admin/Management), separado do front de vendas

> Levantamento feito lendo o backend real (controllers, guards, schema), não é suposição.
> Cobre: minha opinião sobre a abordagem, inventário completo do que já existe pronto,
> gaps que precisam ser resolvidos no backend, e um roteiro de implementação.

---

## 1. Minha opinião sobre a abordagem

**Separar em projeto próprio é a decisão certa.** Não é só preferência — o backend já foi
construído como se essa separação fosse o plano desde o início:

- Existe um sistema de autenticação **inteiramente separado** do de clientes: model `User`
  (tabela `users`, com `role: admin|manager|support`) é diferente de `Customer`. São dois
  domínios de JWT distintos, com guards diferentes (`JwtAuthGuard`/`RolesGuard` pro staff,
  `CustomerAuthGuard` pro cliente). Isso já é exatamente a fundação que um app de gestão
  separado precisa — não seria assim se a intenção fosse misturar admin dentro do site de
  vendas.
- **~18 controllers `admin/*` já existem e funcionam hoje**, protegidos por JWT + role,
  cobrindo praticamente todo o catálogo, pedidos, clientes, marketing e conteúdo da home
  (lista completa na seção 2). Você não está começando do zero — está construindo a
  interface em cima de uma API de gestão que já existe em ~80% de cobertura.
- Separar em app próprio também é mais seguro de operar: dá pra colocar atrás de outro
  domínio/subdomínio, restringir por IP ou VPN mais tarde, não expõe rotas administrativas
  no bundle JS público do site de vendas, e o deploy de um não trava o do outro.

**O que falta não é arquitetura — é fechar 3 gaps reais no backend** antes do app ficar bem
consolidado (detalhado na seção 3): o papel `support` existe no banco mas não tem
permissão nenhuma hoje (é decorativo), não existe um endpoint de dashboard/KPI acessível
pelo login normal de staff, e o controle de acesso é "tudo ou nada" por módulo — não dá pra
dar a alguém acesso de leitura sem dar escrita também.

---

## 2. Inventário — o que já existe no backend (lido direto do código)

### 2.1 Autenticação e usuários de staff

| Endpoint | Método | Descrição |
|---|---|---|
| `POST /admin/auth/login` | público, rate-limited | login de staff, devolve JWT |
| `POST /admin/auth/refresh` | público | renova token via refresh token |
| `POST /admin/auth/logout` | público | invalida refresh token |
| `GET /admin/auth/me` | autenticado | dados do usuário logado |
| `POST /admin/auth/change-password` | autenticado | troca de senha |
| `GET/POST/PATCH/DELETE /admin/users` | `admin`, `manager` | CRUD de usuários de staff (o `POST` cria novo staff) |
| `GET /admin/login-rate-limit-audits` | (checar roles) | auditoria de tentativas de login |

JWT carrega `{ sub, role, email }` — o `role` já é o que o `RolesGuard` usa pra liberar/negar
cada endpoint. **Refresh token com rotação já existe** (model `RefreshToken`), então sessão
persistente/logout remoto já é possível.

### 2.2 Todos os controllers `admin/*` já protegidos (JWT + Roles)

| Módulo | Rota | Roles hoje | Cobertura |
|---|---|---|---|
| Produtos | `admin/products` | `admin` (só) | CRUD completo, imagens, presale, reorder |
| Categorias | `admin/categories` | `admin`, `manager` | CRUD + merge |
| Marcas | `admin/brands` | `admin`, `manager` | CRUD |
| Facetas | `admin/facets` | `admin`, `manager` | CRUD de facet/facet_value |
| Pedidos | `admin/orders` | `admin`, `manager` | list/get/update/status/cancel/presale/delete |
| Clientes | `admin/customers` | `admin`, `manager` | list/export/get/patch/deactivate (sem delete) |
| Ofertas (Make Offer) | `admin/offers` | `admin`, `manager` | accept/reject |
| Pagamentos | `admin/payments` | `admin`, `manager` | (checar escopo exato) |
| Envios | `admin/shipments` | `admin`, `manager` | gestão de shipment |
| Promoções | `admin/promotions` | `admin` (só) | CRUD |
| Newsletter | `admin/newsletter` | `admin`, `manager` | list/export de inscritos |
| Homepage | `admin/homepage` | `admin`, `manager` | hero, tiles, social feed |
| Banners | `admin/banners` | `admin`, `manager` | CRUD |
| Anúncios (topo) | `admin/announcements` | `admin`, `manager` | CRUD |
| Auditoria | `admin/audit-logs` | `admin`, `manager` | leitura do log de auditoria (quem mudou o quê) |
| Relatórios | `admin/reports` | ⚠️ `@Public()` + `AdminApiKeyGuard` | `orders`, `orders/:id`, `sales` — ver nota abaixo |

**Nota sobre `admin/reports`:** não é um buraco de segurança — é protegido por uma API key
estática (`x-admin-key`/`ADMIN_API_KEY`), separada do login de staff. Parece feito pra
integração externa (BI, script, dashboard de terceiro), não pro login normal do app de
gestão. **Decisão a tomar:** o app de gestão vai logar como staff (JWT) e portanto precisa
desses mesmos dados (`getSalesSummary()` já existe!) acessíveis via o `RolesGuard` normal —
ver gap #2 na seção 3.

### 2.3 O que é público de propósito (não precisa mexer)

Loja de clientes (`customers/*`, `cart`, `products`, `categories` públicos, `search`,
`newsletter/subscribe`) continua exatamente como está — o app de gestão não toca nisso,
só consome os endpoints `admin/*`.

---

## 3. Gaps a resolver no backend

### Gap 1 — Papel `support` existe no enum mas não tem NENHUMA permissão

`enum user_role { admin, manager, support }` está no schema, mas **nenhum** `@Roles(...)`
em nenhum controller inclui `support`. Hoje, criar um usuário com esse papel resulta em
alguém que consegue logar mas não acessa nada — 100% inútil na prática.

**Ação:** decidir o que "support" deveria enxergar (sugestão: leitura de pedidos e
clientes, sem poder mexer em catálogo/promoções/produtos) e adicionar `user_role.support`
nos `@Roles(...)` certos — provavelmente `admin/orders` (GET apenas) e `admin/customers`
(GET apenas). Isso exige separar leitura de escrita dentro do mesmo controller, que hoje
usa `@Roles()` na classe inteira (todos os métodos herdam a mesma regra) — vai precisar
mover `@Roles()` pro método em vez da classe nesses dois controllers.

### Gap 2 — Sem endpoint de dashboard acessível pelo login normal de staff

`OrdersService.getSalesSummary()` já existe e funciona, mas só é alcançável via
`admin/reports` com API key estática — não com o JWT que o app de gestão vai usar depois
do login. Um app de gestão sem tela inicial de KPIs (vendas do dia, pedidos pendentes,
estoque baixo, clientes novos) não fica "bem consolidado".

**Ação:** criar `GET /admin/dashboard` (ou reaproveitar `orders.getSalesSummary()` num
novo endpoint dentro de `admin/orders` ou um módulo `admin/dashboard` novo), protegido
pelo `RolesGuard` normal (`admin`, `manager`), agregando pelo menos:
- vendas/pedidos das últimas 24h e 7d (dado já existe em `ProductRanking`/`getSalesSummary`)
- pedidos com status pendente de ação (aguardando pagamento, aguardando envio)
- produtos com estoque baixo/zerado (`Inventory.stockQuantity`)
- assinantes de newsletter novos, clientes novos

### Gap 3 — Controle de acesso é "tudo ou nada" por módulo

Hoje `@Roles()` é aplicado na classe do controller inteira — um usuário `manager` que pode
`GET /admin/products` também pode `DELETE /admin/products/:id`. Pra um app de gestão de
verdade com múltiplos perfis (o que você descreveu: "cada perfil terá seu nível de
acesso"), isso é grosseiro demais. Duas decisões possíveis, em ordem de esforço:

1. **Mínimo viável:** mover `@Roles()` de nível de classe pra nível de método nos
   controllers que precisam de granularidade (ex. `admin/products`: `GET`/`PATCH` pra
   `manager`, `DELETE` só `admin`). Não precisa de tabela nova, é reorganizar decorators
   existentes.
2. **Sistema de permissão de verdade** (se o negócio crescer e pedir isso): trocar `role`
   fixo por uma tabela `permissions`/`role_permissions` (ou `user_permissions` direto),
   onde cada ação de cada módulo é uma permissão nomeada (`orders.read`, `orders.write`,
   `products.delete`, etc.), e o `RolesGuard` vira um `PermissionsGuard` que checa contra
   isso em vez de comparar string de role. Muito mais flexível, mas é trabalho de verdade
   (migration nova, seed de permissões, guard novo, decorator novo). **Recomendo só fazer
   isso se surgir necessidade real de perfis customizados além de admin/manager/support —
   não construir antecipadamente.**

### Gap 4 — CORS do novo app

Não é mudança de código — é configuração. `ALLOWED_ORIGINS` no `.env` já é uma lista
separada por vírgula, e qualquer `localhost:<porta>` já é liberado automaticamente em dev.
Em produção, só precisa adicionar o domínio do app de gestão em `ALLOWED_ORIGINS` quando
ele for deployado. Nenhum código muda.

### Gap 5 — Confirmar cobertura do audit log

`admin/audit-logs` já existe e o `AuditContextStore`/middleware já captura `actorId`,
`actorEmail`, `actorRole` em requests autenticados. Vale confirmar (não assumir) que toda
mutação relevante do admin (produto, pedido, promoção, usuário) está de fato passando por
esse contexto antes de anunciar "toda ação é auditada" no app novo — é o tipo de coisa que
some silenciosamente se um controller novo esquecer de injetar o `AuditLogService`.

---

## 4. Modelo de permissão recomendado (curto prazo, sem migration)

Usar os 3 papéis que já existem, com esse recorte (ajustável antes de implementar):

| Módulo | `admin` | `manager` | `support` |
|---|---|---|---|
| Produtos/Catálogo/Facetas/Marcas | CRUD completo | CRUD, sem delete de produto | leitura |
| Pedidos | CRUD completo | tudo, exceto delete | leitura + mudar status (atender cliente) |
| Clientes | tudo | tudo, exceto deletar conta | leitura |
| Promoções | CRUD | leitura | — |
| Usuários de staff (`admin/users`) | CRUD | leitura | — |
| Homepage/Banners/Anúncios/Newsletter | CRUD | CRUD | — |
| Relatórios/Dashboard | tudo | tudo | leitura básica |
| Auditoria | leitura | leitura | — |

`admin` continua sendo o nível master, como você descreveu — acesso a tudo, inclusive
gestão de outros usuários de staff (só `admin` pode criar/remover outro `admin`).

---

## 5. Arquitetura recomendada do novo projeto

- **Projeto Next.js separado** (mesmo stack do front de vendas, pra reaproveitar
  conhecimento da equipe), domínio/subdomínio próprio (ex. `admin.suaLoja.com`), consumindo
  a mesma API (`stockzy-ecommerce-api`) via os endpoints `admin/*`.
- **Login**: tela própria batendo em `POST /admin/auth/login`, guarda o JWT (mesmo padrão
  de refresh token já existente — usar `POST /admin/auth/refresh` pra sessão persistente).
- **Guarda de rota no front**: decodificar `role` do JWT (ou usar `GET /admin/auth/me`) pra
  esconder/desabilitar seções da UI que o papel do usuário não acessa — mas isso é só UX,
  a segurança real já está garantida pelo `RolesGuard` no backend (o front nunca deveria
  ser a única barreira).
- **Nenhum banco novo, nenhuma API nova separada** — é uma UI nova em cima da API que já
  existe, exceto pelos gaps da seção 3.

---

## 6. Roteiro sugerido

1. **Fechar os gaps do backend** (seção 3) — principalmente #1 (support) e #2 (dashboard),
   são pequenos e desbloqueiam o resto.
2. **Scaffold do projeto novo** + tela de login/autenticação (`admin/auth/*`).
3. **Dashboard inicial** (KPIs do gap #2) — primeira tela depois do login, dá visibilidade
   imediata de valor.
4. **Módulos por ordem de uso diário provável**: Pedidos → Produtos/Catálogo → Clientes →
   Marketing (promoções/banners/homepage/newsletter) → Usuários de staff/Auditoria (por
   último, é o módulo mais sensível e menos usado no dia a dia).
5. **CORS em produção** quando o domínio do app de gestão for definido (gap #4, 1 linha de
   config).

Nada foi alterado no backend — isso é só o planejamento, como pedido.
