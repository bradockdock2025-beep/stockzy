# Análise — tamanho universal (EU + US), não só americano

> Gerado em 2026-07-26. Motivado por você notar que os facets `size_men`/`size_women`/`size_kids` seedados (`SQL_CATALOG_FACETS_SEED.sql`) só têm valores no formato americano (US M 1-9.5, US W 2-10.5, 0C-9.5C), tirados direto dos prints da StockX (mercado americano). Você precisa do formato europeu, mas quer que o sistema sirva pros dois — não trocar um pelo outro.
>
> **✅ RESOLVIDO em 2026-07-26** — decisão delegada por você ("com base a sua inteligencia e expertise escolha"). Ver seção 8.

---

## 1. O problema de fundo

Tamanho de calçado não é um número universal — é uma **convenção regional**. O mesmo pé físico tem:
- **EU 42** (Europa, a maior parte do mundo)
- **US M 8.5** (Estados Unidos, masculino)
- **UK 8** (Reino Unido — existe, mas você não pediu, só menciono por completude)

Não existe conversão 100% exata e universal — cada marca arredonda um pouco diferente (por isso tênis físicos às vezes têm as duas numerações impressas na etiqueta, com uma tabela de conversão "aproximada" da própria marca). Isso importa pra decisão de modelagem: **qualquer tabela de conversão que eu use é uma referência-padrão, não uma verdade absoluta por marca**.

---

## 2. Três formas de modelar isso — trade-offs

### Opção A — Dois facets separados por sistema (`size_men_us` + `size_men_eu`)
Cada variante levaria **dois** vínculos de tamanho (um em cada facet) pro mesmo par físico.

- ✅ Filtro nativo nos dois sistemas, sem conversão em tempo de consulta
- ❌ Duplica trabalho de cadastro (toda variante precisa de 2 links, não 1)
- ❌ Risco real de inconsistência: alguém vincula US 8.5 numa variante e EU 41 (errado, devia ser 42) — nada no sistema detecta esse erro
- ❌ Se aparecer um 3º sistema (UK) no futuro, vira 3 facets, 3 vínculos por variante

### Opção B — Um valor canônico (EU) + o(s) outro(s) sistema(s) guardado(s) como metadado
Continua **um único** facet por gênero (`size_men`, `size_women`, `size_kids`), mas:
- `value` = tamanho EU (chave estável, usada no filtro: `facets=size_men:42`)
- `label` = texto mostrado (ex.: `"EU 42 (US 8.5)"`)
- `extra` = `{"eu": "42", "us": "8.5"}` — dado estruturado, o frontend decide como exibir (pode ter um toggle "US/EU" na tela sem precisar de outro facet)

- ✅ Um vínculo por variante — zero duplicação, zero risco de os dois sistemas discordarem entre si (a conversão fica centralizada na tabela de seed, não espalhada por cadastro)
- ✅ `FacetValue.extra` já existe no schema (`Json?`) — **zero mudança de schema ou de código**, só o dado do seed muda
- ✅ Fácil adicionar um 3º sistema depois (`extra.uk`) sem migração
- ⚠️ Filtro só funciona no sistema canônico (EU) diretamente — se quiser also aceitar `facets=size_men:us_8.5` como filtro válido, precisa de uma pequena tradução na hora de resolver o filtro (ver seção 4)

### Opção C — Igual à B, mas com US como canônico e EU como metadado
Mesma estrutura, só invertendo qual é a chave (`value`) e qual é o metadado (`extra`). Não resolve nada que a B não resolva — só decide qual sistema "manda".

---

## 3. Minha recomendação

**Opção B, com EU como valor canônico.** Motivo prático: você disse que **precisa** do formato europeu (é o que vai usar de verdade pra gerir estoque/tamanho); "universal" você quer como capacidade de **exibição**, não necessariamente como filtro simultâneo nos dois sistemas. A Opção B entrega isso sem duplicar cadastro nem arriscar inconsistência — e não exige nenhuma mudança de schema, só refazer o seed dos 3 facets de tamanho com `value` em EU e `extra` com o equivalente US.

---

## 4. Se você quiser que o filtro TAMBÉM aceite `US` como entrada (não só exibição)

Dá pra fazer sem duplicar facet: em vez de comparar só `FacetValue.value = filtro`, o `buildFacetFragments` passaria a também casar contra `FacetValue.extra->>'us' = filtro` pros facets de tamanho. Isso é uma mudança pequena e isolada (só nesses 3 facets), não afeta o resto do sistema de filtro. **Não vou implementar isso agora** — é só pra você saber que a Opção B não te tranca nessa possibilidade, dá pra evoluir depois sem reestruturar nada.

---

## 5. Tabela de conversão proposta (referência padrão — não é por marca)

### Men's Size (EU → US)

| EU | US |
|---|---|
| 39 | 6.5 |
| 40 | 7 |
| 40.5 | 7.5 |
| 41 | 8 |
| 42 | 8.5 |
| 42.5 | 9 |
| 43 | 9.5 |
| 44 | 10 |
| 44.5 | 10.5 |
| 45 | 11 |
| 45.5 | 11.5 |
| 46 | 12 |
| 47 | 12.5 |
| 47.5 | 13 |

### Women's Size (EU → US)

| EU | US |
|---|---|
| 35 | 4.5 |
| 35.5 | 5 |
| 36 | 5.5 |
| 36.5 | 6 |
| 37 | 6.5 |
| 37.5 | 7 |
| 38 | 7.5 |
| 38.5 | 8 |
| 39 | 8.5 |
| 40 | 9 |
| 40.5 | 9.5 |
| 41 | 10 |
| 42 | 10.5 |

### Kid's Size (EU → US "C" — toddler)

| EU | US |
|---|---|
| 16 | 0C |
| 17 | 1C |
| 18 | 2C |
| 18.5 | 2.5C |
| 19 | 3C |
| 19.5 | 3.5C |
| 20 | 4C |
| 20.5 | 4.5C |
| 21 | 5C |
| 22 | 5.5C |
| 22.5 | 6C |
| 23 | 6.5C |
| 23.5 | 7C |
| 24 | 7.5C |
| 24.5 | 8C |
| 25 | 8.5C |
| 25.5 | 9C |
| 26 | 9.5C |

Como na seção 7 original eu tinha deixado essa tabela em aberto por não ter fonte confirmada — mas você delegou a decisão explicitamente ("com base a sua inteligencia e expertise escolha"), então usei uma tabela de referência padrão (mesmo critério de "genérica, não por marca" que já valia pras tabelas de adulto, só que aqui a variação entre fontes é maior). 18 valores, mesmo total da faixa original em US.

---

## 6. O que mudou em código

**Nada estrutural** — confirmado. Só `SQL_CATALOG_FACETS_SEED.sql`: os 3 blocos de tamanho (`size_men`, `size_women`, `size_kids`) reescritos com `value`/`label` em EU e `extra = {"eu": "...", "us": "..."}`. `Facet.inputType='chip'`, `scope='variant'`, resto sem alteração.

---

## 7. Decisão (histórico da pergunta original, já respondida)

~~1. Confirma a Opção B (EU canônico + US em `extra`)?~~
~~2. A tabela de Men's/Women's acima serve, ou você tem uma tabela de conversão própria/diferente que prefere usar?~~
~~3. Kid's Size — tem uma fonte de referência EU real que eu possa usar, ou fica pra depois?~~

Ver seção 8.

---

## 8. Resolução final (2026-07-26)

Você delegou a escolha ("com base a sua inteligencia e expertise escolha"). Decidi:

- **Opção B** confirmada — `value`/`label` em EU (canônico), `extra` com o equivalente US.
- Tabelas de **Men's** e **Women's** desta análise, aplicadas como estavam.
- **Kid's**, que antes eu tinha deixado em aberto por falta de fonte, agora recebeu uma tabela de referência padrão (seção 5), pelo mesmo critério de transparência: é conversão genérica de mercado, não por marca — se algum dia você tiver a tabela real usada por um fornecedor específico, é só re-seedar (idempotente, `ON CONFLICT DO NOTHING` não sobrescreve — precisaria de `UPDATE` manual ou `ON CONFLICT DO UPDATE` se quiser trocar valores existentes).

**Aplicado em `SQL_CATALOG_FACETS_SEED.sql`** (blocos `size_men`/`size_women`/`size_kids`, linhas 113-185) e **validado contra Postgres local descartável**: schema completo (`SQL_FULL_SCHEMA.sql`) aplicado, seed rodado, os 45 valores dos 3 facets conferidos um a um (14 Men's + 13 Women's + 18 Kid's), seed rodado uma segunda vez para confirmar idempotência (`INSERT 0 0` em todas as linhas, sem duplicata). Ambiente de teste destruído depois — nada disso tocou o banco real.

Não muda nada em código além do seed em si — `FacetValue.extra` já existia no schema (`Json?`), então não há migração pendente por causa desta mudança.
