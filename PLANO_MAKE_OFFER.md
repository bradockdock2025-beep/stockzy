# Plano — "Make Offer" (Fazer uma Oferta)

Baseado nas 4 capturas de tela do fluxo real da StockX que você enviou. Decisão de modelo já tomada (abaixo, com o porquê) — este documento é o plano de implementação, pronto pra eu executar assim que você confirmar.

---

## 1. Por que não é uma cópia 1:1 da StockX — a decisão de modelo

Na StockX real, "Make Offer" não é um botão de compra alternativo — é o motor inteiro do negócio deles: uma **bolsa de compra e venda P2P**. "Highest Offer: $176", "436 people are interested", "598 Sold in Last 3 Days", "Good Offer / Better Offer / Buy Now" — tudo isso vem de um **livro de ofertas real**, com múltiplos vendedores listando "asks" e múltiplos compradores fazendo "bids", casados por um motor de matching, com dados de mercado ao vivo.

Nós **não somos isso** — é loja própria, vendedor único, preço fixo por variante (`ProductVariant.price`), já confirmado várias vezes nesta sessão (inclusive no `ANALISE_MAPEAMENTO_PLP_JERSEYS.md`, onde "Lowest Ask" foi explicitamente marcado como "diferença de modelo de negócio intencional"). Replicar o mecanismo real exigiria: cadastro de vendedores, tabela de listagens/asks, motor de matching, e métricas de mercado — eu não tenho dado nenhum pra gerar "436 pessoas interessadas" ou "598 vendidos em 3 dias" sem inventar número, o que vai contra o princípio desta sessão de nunca fabricar dado de negócio.

**Decisão:** "Make Offer" vira **negociação de preço** dentro do nosso modelo de venda direta — cliente propõe um valor abaixo do preço listado pra uma variante específica; se aceito (automaticamente ou por revisão), ele compra por esse preço, no mesmo checkout que já existe. É uma feature real, com valor de negócio genuíno (fecha vendas que talvez não fechassem no preço cheio), sem fingir ser uma bolsa que não somos.

### O que explicitamente NÃO vou construir
- Múltiplos vendedores / listagens de terceiros
- Livro de ofertas ao vivo / motor de matching bid-ask
- "Good Offer" / "Better Offer" como sugestão algorítmica baseada em histórico de mercado (não temos volume de dado real pra isso)
- "X pessoas interessadas" / "Y vendidos nos últimos 3 dias" — métrica fabricada, não temos dado de verdade por trás

---

## 2. O fluxo, mapeado das 4 imagens pro nosso modelo

| Tela StockX (imagem) | O que vira aqui |
|---|---|
| 1. PDP com botão "Make Offer" ao lado de "Buy Now" | Mesmo layout — PDP já existe (`GET /products/:id`), só adiciona o botão/CTA "Fazer uma Oferta" |
| 2. Seleção de tamanho (toggle EU/US/UK/KR/CM) | Reaproveita as facetas de tamanho que já existem (`size_men`/`size_women`/`size_kids`, `extra.eu`/`extra.us` — ver gap na seção 6) |
| 3. Opções de preço (Good Offer $177 / Better Offer $194 / Buy Now $195 + campo "Or Name Your Price") | **Reinterpretado**: mostra o preço listado (`variant.price`) como "Comprar agora", e um campo livre "Sua oferta" — sem as duas sugestões algorítmicas fabricadas. Pode mostrar uma faixa honesta tipo "ofertas normalmente aceites a partir de X" se você quiser, calculada a partir do `minOfferPercent` real configurado (não inventada) |
| 4. Método de pagamento | Mesmo `POST /customers/orders/:id/payment` / fluxo guest que já existe — sem mudança |

---

## 3. Modelo de dados novo

```prisma
model Offer {
  id                String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  variantId         String       @map("variant_id") @db.Uuid
  customerId        String?      @map("customer_id") @db.Uuid   // null = oferta de guest
  guestEmail        String?      @map("guest_email")
  guestToken        String?      @unique @map("guest_token")     // mesmo padrão do guest checkout já existente
  listedPrice       Decimal      @map("listed_price") @db.Decimal(12, 2)   // snapshot do preço no momento da oferta
  offeredPrice      Decimal      @map("offered_price") @db.Decimal(12, 2)
  status            offer_status @default(pending)
  windowClosesAt    DateTime?    @map("window_closes_at") @db.Timestamptz(6)  // só preenchido se entrar em disputa (4.1)
  rejectionReason   String?      @map("rejection_reason")  // "sold_out" | "outbid" | "below_minimum"
  expiresAt         DateTime     @map("expires_at") @db.Timestamptz(6)
  respondedAt       DateTime?    @map("responded_at") @db.Timestamptz(6)
  respondedBy       String?      @map("responded_by") @db.Uuid   // admin, se revisão manual
  orderId           String?      @unique @map("order_id") @db.Uuid  // preenchido quando vira pedido de verdade
  createdAt         DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  variant  ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  customer Customer?      @relation(fields: [customerId], references: [id])
  order    Order?         @relation(fields: [orderId], references: [id])

  @@index([variantId])
  @@index([status])
}

enum offer_status {
  pending          // abaixo do mínimo, aguardando revisão manual do admin
  pending_window   // bateu o mínimo, mas em disputa de estoque — aguardando fechamento da janela
  accepted         // reservou estoque, aguardando cliente finalizar checkout
  rejected         // veja rejectionReason (sold_out | outbid | below_minimum)
  expired          // aceita mas cliente não finalizou a tempo
  converted        // virou pedido de verdade
}
```

**Campo novo em `ProductVariant`** (ou `Product`, a decidir): `minOfferPercent Int?` — percentual mínimo do preço listado que uma oferta precisa atingir pra ser aceita automaticamente (ex.: `80` = aceita ofertas ≥ 80% do preço). `null` = feature desligada pra essa variante (some o botão "Make Offer" no frontend). Sem esse campo configurado, nenhuma oferta é aceita automaticamente — cai em revisão manual, ou (se você preferir mais simples) fica sempre em revisão manual na v1, sem auto-aceite nenhum.

---

## 4. Regras de negócio

1. **Criar oferta** — `POST /orders/offers` (ou `/products/:variantId/offers`), body `{ offeredPrice, customerId ou guestEmail }`. Valida: `offeredPrice > 0`, variante existe e está ativa/com estoque.
2. **Reserva de estoque na aceitação** — mesmo mecanismo já existente de `reservedQuantity` (`inventory`), com o mesmo timeout de expiração já usado nos pedidos pendentes (`enqueueReservationTimeoutIfNeeded`, reaproveitado). Se a oferta expirar sem virar pedido, libera a reserva.
3. **Oferta aceita → checkout**: cliente recebe (resposta da API + email) um link/token pra finalizar a compra **pelo preço ofertado**, dentro da janela de validade. O checkout (`createGuestOrder`/`createFromCustomerCart`) precisa aceitar um `offerId` opcional e, se presente, usar `offer.offeredPrice` no lugar de `variant.price` pra esse item — ponto de integração real no código existente, não é feature isolada.
4. **Oferta rejeitada/expirada**: libera reserva de estoque, notifica cliente (reaproveita `NotificationsService`), oferece opção de comprar pelo preço cheio.
5. **Uma oferta pendente por vez, por cliente/variante** — evita spam de ofertas simultâneas pro mesmo item.

### 4.1 Concorrência — vários clientes ofertando o mesmo item com estoque limitado

Pergunta real, e eu errei a primeira resposta: cheguei a propor "quem chega primeiro leva", e isso está **errado** — ignora completamente o valor da oferta, o que não faz sentido nenhum de negócio (ninguém oferece o preço cheio pra perder pra quem ofereceu o mínimo só por ter clicado antes). Corrigindo:

**Decisão: quando o item está genuinamente disputado (mais ofertas qualificadas do que estoque), decide por valor — a mais alta ganha — dentro de uma janela de tempo curta e limitada, não instantaneamente no clique.** Quando **não** está disputado (estoque sobra pra todo mundo que já ofereceu), aceita na hora, sem esperar ninguém.

**Correção sobre "o momento em que não há disputa":** a primeira versão desta regra decidia isso no instante da chegada (`available > qualifyingPending` calculado na hora) — mas isso está errado, porque duas pessoas quase nunca ofertam no mesmíssimo milissegundo. Elas ofertam com minutos de diferença, e "sem disputa no instante X" não prova nada sobre o instante X+3min. Uma oferta só pode ser considerada "sem concorrência" depois de esperar um tempo — não no momento em que chega. A pergunta certa não é "tem outra oferta *agora*?", é "**este item está escasso o suficiente pra valer a pena esperar um pouco antes de confirmar?**":

```
1. Oferta chega, calcula se bate o mínimo (offeredPrice >= listedPrice * minOfferPercent/100)
   Se não bate → cai em revisão manual do admin (fora da disputa por valor, é caso a caso)

2. Se bate o mínimo, verifica a escassez real:
     available = stock_quantity - reserved_quantity (variante, com FOR UPDATE)
     scarcityThreshold = 1 (configurável por produto — "esta oferta consumiria
                             a(s) última(s) unidade(s)?")

     SE available > scarcityThreshold  (sobra estoque folgado mesmo depois desta oferta):
        aceita ESSA oferta na hora → reserva 1 unidade, status = accepted
        (estoque não é escasso, não vale a pena segurar ninguém esperando)

     SENÃO  (esta oferta disputaria uma unidade escassa — a última, ou uma das últimas):
        entra em status = pending_window
        se é a primeira oferta nessa faixa de escassez pra essa variante, abre
        uma janela curta e FIXA (ex.: 10 min, bem mais curta que um leilão —
        só o suficiente pra pegar quem oferta minutos depois, não horas depois)
        outras ofertas que chegarem durante essa janela entram no mesmo grupo

3. Ao fechar a janela (job agendado, mesmo padrão BullMQ dos outros timeouts):
     pega todas as `pending_window` daquela variante/janela
     ordena por offeredPrice DESC (empate: a mais antiga primeiro)
     aceita as N primeiras, N = estoque disponível no fechamento
     reserva estoque pra cada uma aceita
     rejeita o resto como "outbid" (superada), notifica todo mundo

     SE só havia 1 oferta na janela quando ela fechou → é aceita nesse momento,
     por mais mínimo que seja o valor (desde que tenha batido o mínimo no passo 1).
     É exatamente aqui, no FECHAMENTO da janela sem concorrente ter aparecido,
     que "não há disputa" é decidido — nunca na chegada.
```

**Exemplo concreto, respondendo diretamente "que momento é considerado sem concorrência":** variante com **1 unidade restante**, mínimo $170.
- `10:00` — chega oferta de $175. `available = 1` ≤ `scarcityThreshold` → não aceita na hora, abre janela até `10:10`
- `10:04` — chega oferta de $190 pra mesma variante → entra na mesma janela (ainda aberta)
- `10:10` — janela fecha → compara: $190 > $175 → **$190 ganha**, $175 vira `outbid`

Se a segunda oferta não tivesse aparecido até `10:10`, a de $175 seria aceita **nesse instante** — nem um segundo antes disso.

**Efeito com estoque de 5 unidades e só 2 ofertas:** `available (5) > scarcityThreshold (1)` mesmo depois de reservar pra ambas → nenhuma é escassa, cada uma é aceita na hora, sem esperar janela nenhuma. Não faz sentido segurar quem não está disputando nada.

**Por que não é a mesma coisa que virar bolsa P2P:** não tem múltiplos vendedores, não tem livro de ofertas permanente, não tem matching contínuo — é uma comparação pontual, só quando o estoque está escasso de verdade, resolvida uma vez, com janela curta e fixa (minutos, não horas/dias). Reaproveita a mesma mecânica de lock/timeout que já existe pros pedidos, só aplicada num momento de decisão em vez de "sempre".

**Ajuste no modelo de dados:** `offer_status` ganha `pending_window` (aguardando resolução por escassez) e o motivo de rejeição precisa distinguir `sold_out` (nunca teve chance — estoque já tinha ido embora antes de ela sequer qualificar) de `outbid` (entrou na janela de disputa e perdeu pra uma oferta maior) — mensagens diferentes pro cliente. `Offer` ganha `windowClosesAt DateTime?`, preenchido só quando entra em `pending_window`. `ProductVariant`/`Product` ganha `offerCollisionWindowMinutes Int?` (default ex.: 10), configurável por produto — itens muito raros podem justificar uma janela um pouco maior.

---

## 5. Endpoints novos

| Rota | Auth | Descrição |
|---|---|---|
| `POST /products/:variantId/offers` | Público (guest) / Cliente | Cria a oferta. Body: `{ offeredPrice, email? }` (guest) ou usa customer autenticado |
| `GET /orders/offers/:id` | Dono da oferta (guest token ou customer) | Consulta status |
| `POST /orders/guest/from-offer` / `POST /customers/orders/from-offer` | Mesma auth do checkout normal | Finaliza o pedido usando `offerId`, preço travado |
| `GET /admin/offers` | Admin (`admin`/`manager`) | Fila de revisão — ofertas `pending` |
| `PATCH /admin/offers/:id/accept` / `.../reject` | Admin | Decisão manual |
| `PATCH /admin/products/:id` (campo novo) | Admin | Configura `minOfferPercent` por variante |

---

## 6. Gaps identificados nas capturas (fora do escopo de "Make Offer" em si, mas relevantes pro fluxo)

- **Toggle EU/US/UK/KR/CM de tamanho**: hoje só guardamos `extra.eu`/`extra.us` no `FacetValue` de tamanho (`SQL_CATALOG_FACETS_SEED.sql`) — **não temos UK nem KR nem CM**. Se o seletor de tamanho da oferta precisar desses sistemas, é dado novo a cadastrar, não é backend novo (mesma estrutura `extra` JSON já suporta, só falta preencher).
- **"Xpress Ship available. Get it by Aug 11"** (imagem 1): não existe esse conceito no backend (mesma lacuna já registrada duas vezes antes, homepage e jerseys). Fora do escopo deste plano.

---

## 7. Fases de implementação sugeridas

1. **Fase 1 — IMPLEMENTADA** (`src/modules/offers/`, testada localmente e contra produção real via `POST /products/:variantId/offers`, ver ANALISE_IMAGENS_ANGULOS_VARIANTE.md e sessão de testes com os Jordan sneakers). Cobre: schema (`Offer` + `offer_status`, sem `minOfferPercent` ainda — ver nota abaixo), criar oferta (guest e cliente), revisão manual pelo admin (`/admin/offers`), checkout no preço negociado, **e mais do que o escopo original mínimo**:
   - Expiração automática da janela de revisão (`offer.review_timeout`, fila BullMQ `offers`) — se ninguém decidir a tempo, a oferta expira sozinha em vez de ficar "pending" pra sempre
   - Expiração automática da janela de checkout pós-aceite (`offer.acceptance_timeout`) — libera a unidade reservada se o cliente não finalizar a tempo
   - Notificações por email: interna pro time quando chega oferta nova (`offer-internal.hbs`, senão "revisão manual" não tem gatilho nenhum), e pro cliente/guest quando aceita ou rejeita (`offer-accepted`/`offer-rejected`, 4 idiomas, campo `locale` novo no `Offer`)

   **Pendente pra Fase 1 valer em produção:** rodar `prisma/migrations/20260809_add_offers/migration.sql` — ainda não foi aplicado no banco real.

2. **Fase 2 — não implementada.** Auto-aceite via `minOfferPercent` + motor de concorrência/janela por escassez (§4.1). Deliberadamente adiada: com baixo volume de ofertas simultâneas, a fila de revisão manual (Fase 1) já resolve sem precisar do motor de disputa por valor — construir isso antes de haver contenção real seria estrutura pra requisito hipotético.
3. **Fase 3 — parcialmente absorvida na Fase 1** (as notificações de aceite/rejeição/interna já foram implementadas junto, ver acima). O que falta de Fase 3: notificação de oferta expirada (silenciosa hoje, não avisa ninguém).
