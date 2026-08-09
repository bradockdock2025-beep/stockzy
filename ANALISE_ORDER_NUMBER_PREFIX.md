# Análise — retificar o prefixo do número do pedido (`DJ-` → novo)

**Resolvido**: prefixo escolhido foi `STKZ-`. Aplicado em `orders.service.ts:908` + `BACKEND_BUSINESS_RULES.md`, `ANALISE_ESTRUTURA_E_BANCO.md`, `SQL_FULL_SCHEMA.sql` (comentário), `docs/guest-checkout-cart-token-guide.md`, `docs/guest-checkout-dual-flow.md`. Pedidos antigos com `DJ-` foram mantidos como estão (histórico). Nenhuma alteração de banco foi necessária.

## 1. Onde o prefixo é gerado (fonte única)

`src/modules/orders/orders.service.ts:904-909`:

```ts
private async generateOrderNumber(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('orders_display_seq')
  `;
  return `DJ-${String(rows[0].nextval).padStart(8, '0')}`;
}
```

Chamado em dois pontos (`createFromCustomerCart` linha 214 e `createGuestOrder` linha 1477) — mesmo método, mesma sequência (`orders_display_seq`), sem duplicação. **É a única linha de código que precisa mudar.** `DJ` são as iniciais de "Doja" — resíduo do projeto original, já sinalizado antes em `ANALISE_ESTRUTURA_E_BANCO.md` (decisão pendente #1) e nunca resolvido.

A sequência (`orders_display_seq`, `START WITH 10000 INCREMENT BY 1`) é um objeto Postgres puro, independente do prefixo — trocar o texto `DJ-` não exige nenhuma migração de banco. O número que vem depois do prefixo continua de onde estiver.

## 2. Pedidos reais já existem com `DJ-`

Você confirmou nesta sessão que recebeu um e-mail de confirmação de um pedido guest de teste feito via Stripe real — ou seja, **já existe pelo menos um pedido real no banco de produção com `orderNumber` no formato `DJ-XXXXXXXX`**, com e-mail de confirmação já enviado citando esse número.

**Recomendação: não renomear pedidos já existentes.** Motivos:
- O `orderNumber` já foi comunicado ao cliente (e-mail, possivelmente recibo/PDF já baixado)
- Pode estar referenciado em metadata do Stripe (`metadata: { orderNumber: order.orderNumber }`, ver `payments.service.ts:266`)
- Renomear é reescrita de dado histórico sem ganho real — só new orders precisam do prefixo novo

Ou seja: a mudança é **só no código** (troca o literal `DJ-` → novo prefixo), efetiva a partir do próximo pedido criado. Pedidos antigos ficam com `DJ-` para sempre, como registro histórico — isso é normal e não é inconsistência.

## 3. Escolha do novo prefixo

Meu candidato: **`STZ-`** (Stockzy, 3 letras, mesmo padrão de tamanho do `DJ-` atual — só que com 2 chars). Alternativas equivalentes: `STK-`, `SKZ-`.

Não decidi por você — só listo as opções mais óbvias derivadas de "Stockzy":

| Prefixo | Observação |
|---|---|
| `STZ-` | 3 letras, lê-se "Stockzy" facilmente, sem colisão óbvia |
| `STK-` | Também soa "stock", reforça o conceito StockX-like do produto |
| `SKZ-` | Foneticamente mais próximo de "Stockzy" |

Formato mantém: `PREFIXO-` + 8 dígitos com zero à esquerda (`padStart(8, '0')`), sem mudar o resto da lógica.

## 4. Arquivos que citam `DJ-` (fora do código-fonte)

Nenhum outro é executável — são documentação/análise, mas ficam desatualizados se só o código mudar:

| Arquivo | Linha | Conteúdo | Ação |
|---|---|---|---|
| `BACKEND_BUSINESS_RULES.md` | 221 | `formato \`DJ-{8 dígitos}\`` | Atualizar prefixo |
| `ANALISE_ESTRUTURA_E_BANCO.md` | 54, 93, 132 | Documenta o `DJ-` como pendência aberta | Marcar decisão como resolvida |
| `SQL_FULL_SCHEMA.sql` | 1077 | Comentário explicando `orders_display_seq` cita `DJ-XXXXXXXX` como exemplo | Atualizar comentário (não afeta SQL executável) |
| `docs/guest-checkout-cart-token-guide.md` | 88 | Exemplo `DJ-00010096` | Atualizar exemplo |
| `docs/guest-checkout-dual-flow.md` | 190 | Exemplo `"DJ-2026-00123"` | Achado à parte: esse formato **já está errado hoje**, mesmo com `DJ-` — o código real nunca gera algo com ano embutido (`2026`), sempre são 8 dígitos sequenciais (`DJ-00010123`, por ex.). Doc desatualizado independente da troca de prefixo. |
| `prisma/migrations/20260603_orders_display_sequence/migration.sql` | 3 | Comentário histórico da migration original | **Não tocar** — é registro histórico de uma migration já aplicada, mudar o comentário não muda nada rodado e quebra o princípio de não reescrever migrations aplicadas |

## 5. Resumo do que mudaria (se você aprovar)

- 1 linha de código (`orders.service.ts:908`): `DJ-` → prefixo escolhido
- 4 arquivos de documentação atualizados com o novo exemplo (business rules, análise de estrutura, guia de cart-token, schema SQL comment)
- 1 correção à parte no `guest-checkout-dual-flow.md` (formato de exemplo já estava errado, independente do prefixo)
- **Nenhuma migração de banco**, nenhum pedido antigo tocado
- Teste local (Postgres descartável, mesmo processo já usado nesta sessão) confirmando que o próximo pedido criado sai com o novo prefixo, antes de você rodar em produção — não precisa de SQL nenhum aqui, é puro deploy de código

## Pergunta em aberto

Qual prefixo você quer: `STZ-`, `STK-`, `SKZ-`, ou outro de sua preferência? Assim que confirmar, executo a troca (só o código + docs, nada no banco).
