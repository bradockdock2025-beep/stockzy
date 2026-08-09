# Análise — consistência do sistema implementado e plano por fases pra V1

> Gerado em 2026-07-28. Análise de baixo pra cima, a partir do que está implementado (23 módulos, 184 endpoints) — não comparando contra `buildingConcept/` (descartado a pedido seu). Foco só em dado e regra de negócio, não em vitrine/decoração. Nada foi alterado.

---

## 1. O que está sólido (não precisa de atenção agora)

- **Catálogo por facetas** (`Facet`/`FacetValue`/`Brand`/`Category`/`Product`/`ProductVariant`): auto-exclusão, visibilidade condicional, geração de SKU — reconstruído e validado com dado real nesta sessão.
- **Checkout core** (`orders.service.ts`): confere estoque real (`stockQuantity - reservedQuantity`) e resolve/aplica promoção antes de criar o pedido — não confia em preço/estoque vindo do cliente.
- **Padrão público/admin** nos módulos de vitrine (homepage, banners, announcements, newsletter, products, search): cada um tem um controller público (`@Public()`, só leitura) separado do controller admin (`@Roles`, CRUD completo) — padrão consistente e replicado direito.
- **Sistema antigo de atributos**: confirmado, zero referência restante em todo o `src/` (varredura completa) — código 100% migrado pro Facet.

---

## 2. Inconsistências reais encontradas

> **✅ As 3 resolvidas em 2026-07-28** — código corrigido e validado contra Postgres+Redis locais (categoria pública, carrinho hidratado, quote de convidado, e o SQL de correção do `size_apparel`). Detalhe de cada uma abaixo, mantido para registro.

### 2.1 `/categories` — duplicado e inacessível ao público

Existem **dois controllers fazendo a mesma coisa**:
- `categories.admin.controller.ts` → `/admin/categories` (CRUD completo, admin)
- `categories.controller.ts` → `/categories` (CRUD **idêntico**, também travado por `@Roles(admin, manager)`)

O segundo é sobra — parece o controller original antes de alguém criar o `/admin/categories` com o prefixo certo, e nunca foi removido nem convertido em leitura pública. Resultado prático: **não existe nenhum endpoint público pra listar categoria** (menu, navegação, filtro por categoria no storefront). Compara com os outros módulos de vitrine (seção 1) — todos têm um controller público de leitura; categoria é o único que não tem.

Isso é dado de negócio de verdade: sem isso, o site público não lista categoria nenhuma via API.

### 2.2 Carrinho não resolve dado real de produto

`cart.service.ts` só injeta `RedisService` — **nunca consulta o Postgres**. `GET /cart` devolve só `{ token, items: [{ variantId, quantity }], updatedAt }`: sem nome, imagem, preço ou confirmação de que o produto ainda existe/está ativo/tem estoque.

Isso é diferente de "está incompleto por design" — comparando com o resto do fluxo: `POST /customers/orders/quote` (cliente logado) resolve o carrinho pra preço/estoque real antes de finalizar. Mas **`orders/guest` não tem equivalente** — o convidado vai direto de um carrinho não-hidratado pra `POST /orders/guest`, sem nenhum passo de conferência (nome do produto, preço final, frete) antes de criar o pedido de vez.

Ou seja: hoje, pra mostrar um carrinho de verdade (nome/imagem/preço) o frontend precisaria buscar cada `variantId` manualmente noutro endpoint — e não existe um endpoint de "produto por variantId" pronto pra isso (o `/products/:id` é por produto, não por variante).

### 2.3 `size_apparel` com regra de visibilidade diferente do resto do sistema

Registrado na análise anterior, mantenho aqui por ser inconsistência de regra de negócio real: `size_men`/`size_women`/`size_kids` usam visibilidade **dinâmica** (`always` + some da resposta se zerar) — `size_apparel` (que eu criei depois) usa visibilidade **fixa por categoria** (`category_family: vestuario`). É o mesmo tipo de dado (tamanho de variante), tratado com duas regras diferentes sem motivo de negócio pra isso. Corrigir é trocar 1 linha no seed.

---

## 3. Decisões de negócio ainda pendentes (não é bug, é você quem decide)

Já registradas em documentos anteriores desta sessão, resumindo aqui pra não se perder:

- **Cardinalidade de faceta por produto** (ex.: pode um produto ter 2 cores marcadas ao mesmo tempo? deveria travar em 1?) — `LEVANTAMENTO_AJUSTES_CATALOGO_FACET.md` item 6.
- **Guardrail categoria↔faceta** (impedir vincular uma faceta sem sentido pra aquela categoria, ex. Shoe Height numa Trading Card) — item 7.
- **Prioridade SKU dual-source** (quando existir os dois sistemas de atributo confirmados — hoje moot, já que o antigo foi removido na Fase 4) — item 8, **na prática já resolvido pela remoção do sistema antigo**, pode ser fechado.
- **Marcas**: as 43 marcas cadastradas são dado de desenvolvimento (vieram da varredura de `STORAGES/`), não o catálogo definitivo — precisa de decisão de quais marcas reais a stockzy vai vender antes de produção.
- **Categorias**: estrutura confirmada (`PROPOSTA_ESTRUTURA_CATEGORIAS.md`) e já no banco — isso está fechado, só falta produto real dentro dela.
- **Produto real**: só os 36 de teste existem; produto de verdade é a última etapa, por decisão sua já dada.

---

## 4. Plano por fases — o que falta pra ter o fluxo de Versão 1

### ✅ Fase A — Fechar as inconsistências da seção 2 (concluída 2026-07-28)
1. ~~Resolver `/categories` público~~ — controller duplicado virou leitura pública real (`findPublicTree`/`findPublicOne`, só categoria ativa, CRUD continua só em `/admin/categories`)
2. ~~Corrigir `size_apparel`~~ — `always` no seed + `SQL_FIX_SIZE_APPAREL_VISIBILITY.sql` gerado pro banco real (já rodou a versão antiga)
3. ~~Hidratação do carrinho~~ — `CartService` agora resolve nome/imagem/marca/preço/estoque real por item (`available: false` se variante sumiu/inativa/sem estoque, carrinho não é alterado sozinho); `GET /orders/guest/quote` novo, mesmo papel que o quote do cliente logado já tinha, guest também ganha preview antes de finalizar

### Fase B — Fechar as decisões de negócio em aberto (seção 3)
4. Cardinalidade de faceta e guardrail categoria↔faceta (itens 6-7) — decisão sua, depois implementação
5. Confirmar lista de marcas reais (substituir/complementar as 43 de dev)

### Fase C — Testar o fluxo de ponta a ponta com dado real do catálogo novo
6. Adicionar 1 dos 36 produtos de teste no carrinho → gerar quote → fazer um pedido de teste (guest e/ou cliente logado) → confirmar que email/recibo saem certos (já portamos isso na Fase 4, mas nunca testamos o fluxo de compra inteiro com produto Facet-based de verdade, só a leitura/filtro)
7. Confirmar pagamento Stripe em modo teste com um desses pedidos

### Fase D — Dado real de produto (última etapa, por decisão sua)
8. Organizar categoria/modelo/imagem reais e rodar o pipeline de inserção (já pronto e validado, `scripts/generate-products-sql.ts` + upload manual de imagem)
9. Rodar `SQL_PHASE4_CHECK_OLD_TABLES.sql` + `SQL_PHASE4_DROP_OLD_TABLES.sql` no banco real, se ainda não rodou

Isso é a sequência que fecha o sistema pra uma V1 de verdade — cada fase não depende de decisão de negócio que ainda não foi tomada, exceto onde eu marquei explicitamente ("por decisão sua").
