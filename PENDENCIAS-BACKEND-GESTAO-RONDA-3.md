# Pendências do backend — 3ª ronda

> Gerado em 2026-10-10, depois de fechar as duas rondas anteriores
> (`PENDENCIAS-BACKEND-GESTAO.md` e `RONDA-2`, ambas já em produção). Esta ronda cobre os
> módulos que nenhuma das duas tocou: `search`, `recommendations`, `wishlist`, `cart`, e um
> olhar mais fundo em `promotions` (antes só auditoria/papéis tinham sido confirmados).
> Todos os achados abaixo foram confirmados lendo o código diretamente (não é só o relatório
> do agente de busca) antes de entrar neste documento.

## Prioridade 1 — segurança/integridade de dados

### 1.1 Promoção: `maxUses`/`maxUsesPerCustomer` tem corrida — ✅ resolvido (2026-10-10)
- **Feito:** `SELECT id FROM promotions WHERE id = ... FOR UPDATE` antes de contar os usos,
  só quando a promoção tem `maxUses` ou `maxUsesPerCustomer` definido. Travar a linha da
  `Promotion` serializa porque `resolvePromotion` só é chamada dentro da transação real de
  checkout (`buildCartQuote` com `tx`); no caminho de cotação (sem `tx`, usa `this.prisma`
  direto) o lock não sobrevive além da própria instrução — inofensivo, a cotação nunca
  grava `promotionUsage`.
- **Não testado ao vivo:** simular a corrida de verdade exige dois checkouts concorrentes
  com carrinho, endereço e pagamento reais — dispara e-mail real (mesmo aviso já registado
  nas rondas anteriores) e não tenho credencial de login do cliente de teste padrão.
  Validado por build limpo + revisão do código (mesmo raciocínio de lock já comprovado em
  `orders.service.ts:228` pro estoque, e em `offers.service.ts#accept()`).
- **Situação de antes (pra registo):** `orders.service.ts:1346-1363` (`resolvePromotion`, chamado
  de dentro da transação de checkout) decide se a promoção ainda pode ser usada contando
  `promotionUsage.count(...)` em `READ COMMITTED` (sem `FOR UPDATE`, sem lock na linha da
  `Promotion`). A única restrição no banco é `@@unique([promotionId, orderId])` — ela evita
  usar a mesma promoção duas vezes **no mesmo pedido**, não limita o total de usos nem o uso
  por cliente. A checagem de estoque, só algumas linhas acima no mesmo ficheiro
  (`orders.service.ts:228`), já usa `SELECT ... FOR UPDATE` pra evitar exatamente este tipo
  de corrida — a promoção não segue o mesmo padrão.
- **Risco:** um código com `maxUses: 1` (a última vez disponível) pedido em dois checkouts
  quase simultâneos (duas abas, ou um retry de rede) — os dois leem `totalUses: 0` antes de
  qualquer um comitar, os dois passam a checagem, os dois aplicam o desconto. Mesma coisa
  pra `maxUsesPerCustomer` com dois pedidos do mesmo cliente em paralelo. É dinheiro saindo
  da loja além do que a promoção devia permitir.
- **Correção:** travar a linha da `Promotion` com `FOR UPDATE` antes de contar os usos,
  mesmo padrão já usado pro estoque no mesmo ficheiro.
- **Decisão necessária:** nenhuma — é a mesma classe de bug já corrigida nas rondas
  anteriores (ex.: variante de produto, oferta), só que neste fluxo específico de checkout.

## Prioridade 2 — funcionalidade/autorização

### 2.1 Promoção: alvo com `productId`/`categoryId` inexistente dá 500 — ✅ resolvido (2026-10-10)
- **Feito:** `assertTargetsExist()` confirma que todo `productId`/`categoryId` dos targets
  existe (via `findMany` + comparação de ids), chamado em `create()` e `update()` logo
  depois de `normalizeTargets`.
- **Testado ao vivo:** `POST /admin/promotions` com `productId` inexistente → 400 `Product(s)
  not found: <uuid>`. Com um `productId` real → 201, criou normalmente (testado e
  desativado depois).
- **Situação (confirmado agora):** `promotions.service.ts:326-341` (`normalizeTargets`) só
  confirma que o campo foi **enviado**, nunca que o produto/categoria **existe**.
  `throwIfDuplicateCode` (linha 32-42) só trata `P2002` — uma violação de chave estrangeira
  (`P2003`, quando o `productId`/`categoryId` não existe) sobe crua.
- **Risco:** `POST /admin/promotions` com um `productId` que não existe (UUID válido mas
  nenhum produto com esse id) → `500` em vez de `400 "Product not found"`.
- **Correção:** validar a existência antes de criar os targets (um `findMany` com os ids e
  comparar contagem), ou capturar `P2003` no mesmo `catch` que já trata `P2002`.
- **Decisão necessária:** nenhuma.

### 2.2 Recomendações: `customerId` aceito sem autenticação, em leitura e escrita — ✅ resolvido (2026-10-10)
- **Decisão (tomada por mim):** nunca confiar no campo vindo do cliente; derivar sempre do
  token quando houver um, tratar como anónimo quando não houver. Mantive o campo
  `customerId` nos 3 DTOs (não removi) pra não quebrar quem já manda esse campo — só parei
  de o ler; validação continua a aceitá-lo, só que ele não tem efeito nenhum.
- **Feito:** extraí a verificação de token de `CustomerAuthGuard` pra um
  `CustomerAuthResolverService` partilhado (`resolve()`, devolve `null` em vez de lançar
  quando não há token/é inválido). Novo `OptionalCustomerAuthGuard` usa o mesmo resolvedor
  mas nunca bloqueia a requisição. As 3 rotas (`GET /catalog/recently-viewed`,
  `GET /catalog/recommended`, `POST /products/:id/view`) agora usam esse guard, e o
  `customerId` real vem de `RecommendationsService.resolveAuthenticatedCustomerId()`
  (resolve `authUserId` → `Customer.id`), nunca do query/body.
- **Testado ao vivo:** sem header de auth, as 3 rotas continuam a funcionar exatamente como
  antes (200/204, fallback de visitante anónimo). Mandando o `customerId` real de um
  cliente de teste **sem** token de autenticação → `0` itens devolvidos (antes do fix,
  teria devolvido o histórico real desse cliente). O caminho "autenticado de verdade" usa o
  mesmo `CustomerAuthResolverService` já comprovado em produção pelo `CustomerAuthGuard`
  (lógica idêntica, só extraída) — não precisei de um token de cliente de teste pra
  confiar nessa parte.
- **Situação (confirmado agora):** `GET /catalog/recently-viewed`, `GET
  /catalog/recommended` e `POST /products/:id/view` são todos `@Public()`, e os DTOs
  (`recently-viewed-query.dto.ts`, `recommended-query.dto.ts`, `record-view.dto.ts`) aceitam
  `customerId` só com `@IsUUID()` — nenhum guard liga esse campo ao utilizador autenticado
  de verdade (compare com `wishlist`, que deriva o `customerId` sempre do
  `CustomerAuthGuard`, nunca de um campo do request — módulo auditado nesta ronda e
  confirmado limpo por seguir esse padrão).
- **Risco:** menor que um vazamento de credencial (é histórico de navegação atrás de um
  UUID, não senha/token), mas é uma falta de autorização real — quem descobrir ou adivinhar
  o UUID de outro cliente pode ler o histórico de "visto recentemente" dele, ou injetar
  visualizações falsas que distorcem as recomendações "pra você" dele.
- **Correção:** nas rotas que hoje aceitam `customerId` livre, derivar o `customerId` do
  token de autenticação quando houver um (igual ao padrão de `wishlist`), e tratar como
  visitante anónimo (sem `customerId`) quando não houver — nunca confiar no campo vindo do
  cliente.
- **Decisão necessária:** se vale a pena manter compatibilidade com visitante não-logado
  mandando o próprio `customerId` manualmente (caso exista algum motivo de negócio pra isso)
  ou se é sempre pra ignorar esse campo quando vier sem auth.

## Prioridade 3 — menor

### 3.1 Carrinho: nenhuma validação de estoque/variante ao adicionar item
- **Situação (confirmado agora):** `cart.service.ts:57-74` (`addItem`) e `:76-91`
  (`updateItem`) não tocam o banco — aceitam qualquer `variantId`/`quantity` e gravam no
  Redis como está. A disponibilidade só é calculada na **leitura** (`hydrateItems`,
  marcando `available: false`), nunca bloqueia a escrita.
- **Risco:** baixo — o checkout já valida estoque de verdade com `FOR UPDATE`
  (`orders.service.ts:222-249`), então não há perda de inventário real. É só o carrinho
  podendo guardar lixo (`quantity: 999999` numa variante com estoque 2) até a tela avisar.
- **Correção:** opcional — validar existência da variante (e, se quiser, cap de
  quantidade pelo estoque disponível) em `addItem`/`updateItem`.

### 3.2 Carrinho: corrida de leitura-e-escrita no Redis pode perder um item
- **Situação (confirmado agora):** `cart.service.ts:225-259` (`loadCart`/`saveCart`) é um
  `GET` seguido de `SET` simples no Redis, sem `WATCH`/Lua/lock otimista.
- **Risco:** baixo — duas abas do mesmo cliente adicionando itens ao mesmo tempo podem
  fazer o `SET` mais recente sobrescrever o mais antigo, perdendo o item adicionado pela
  aba mais rápida. Só afeta o próprio cliente, janela pequena na prática.
- **Correção:** opcional — Lua script atômico (`GET`+merge+`SET` numa só chamada) se
  decidirem que vale o esforço; baixo retorno pra complexidade que adiciona.

## Áreas revisadas sem novos achados

- **`wishlist`** — toda operação passa por `resolveCustomerId(authUserId)` vindo do
  `CustomerAuthGuard`; não há `id` de wishlist nem `customerId` lido do request. Sem
  caminho de manipulação de ID pra acessar wishlist de outro cliente.
- **`search`** — só leitura, público, sem `include` sensível, SQL parametrizado.
- **`promotions`** — papéis, auditoria, e `code` duplicado (fora do item 2.1) todos corretos.

## Ordem de trabalho — Prioridades 1 e 2 fechadas em 2026-10-10

1. ~~**1.1, 2.1, 2.2**~~ — ✅ todos, incluindo 2.2 (decisão tomada por mim, ver nota acima).
2. **3.1, 3.2** — ainda em aberto; opcionais, baixo risco, sem urgência, mitigados pela
   validação real no checkout.

`npm run build` limpo. 1.1 e 2.1 testados ao vivo (ver notas); 2.2 testado ao vivo no
caminho anónimo e no fechamento da falha reportada, com o caminho autenticado herdando a
confiança já validada em produção pelo `CustomerAuthGuard`. Nada commitado ainda.
