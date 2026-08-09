# Estrutura da Página — StockX /category/accessories (filtros)

Baseado em print real da página (sidebar parcialmente visível, cortada depois de "MEN'S SIZE" — não sei se tem mais itens abaixo).

## Ordem da sidebar capturada

`Available Now` (não visível no print, mas provavelmente ali) → `Xpress Ship` → `Below Retail` → `CATEGORY` (colapsado) → `GENDER` (expandido) → `BRANDS` → `ACTIVITY` → `COLOR` → `PRICE` → `MEN'S SIZE` → *(corta aqui, pode ter mais)*

## Detalhe novo — CATEGORY colapsado mostra um resumo

Diferente dos prints anteriores (onde só vimos CATEGORY expandido), aqui ele está **fechado** e mostra, embaixo do título, uma linha pequena com o valor atual: **"Accessories"**. Ou seja, o acordeão colapsado não fica em branco — sempre mostra um resumo de qual categoria está ativa. Vale aplicar esse mesmo padrão nos outros filtros (Brands, Color etc. provavelmente também mostram um resumo curto quando fechados, se tiverem valor selecionado).

## GENDER — mesma faceta, ordem diferente

Aparece igual às outras páginas de categoria (Sneakers, Shoes), confirmando de novo que Gender só aparece quando não está fixo pela URL. Mas repara na ordem dos valores aqui: **Unisex, Men, Women, Kids** — diferente da ordem vista antes (Men, Women, Kids, Unisex). Pode ser só reordenação dinâmica (ex.: por relevância/quantidade de produtos no contexto atual) e não uma ordem fixa cadastrada.

## Achado importante: MEN'S SIZE aparece em Accessories

Isso **contradiz** a hipótese que tínhamos fechado em [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md), de que os filtros de tamanho (Men's/Women's/Kid's Size) eram exclusivos da família "calçado" (Sneakers/Shoes). Accessories não é calçado — é relógio, óculos, mochila, gorro etc. (dá pra ver no grid do print: Casio G-Shock, Swatch x Audemars Piguet, Saint Laurent sunglasses, BAPE backpack, Supreme balaclava) — e mesmo assim tem MEN'S SIZE.

Faz sentido pensar melhor: alguns acessórios têm tamanho de verdade (relógio pode ter tamanho de pulseira, balaclava/luva pode ter P/M/G) — mas nem todo produto do grid tem isso (backpack não tem "tamanho" no sentido de numeração). Então provavelmente esse "MEN'S SIZE" não é sobre calçado, é um filtro genérico de tamanho que **aparece se pelo menos um produto daquela busca tiver variação de tamanho cadastrada** — não é fixo por família de categoria como pensamos antes.

Não vi neste print se `WOMEN'S SIZE` e `KID'S SIZE` também aparecem aqui (cortou a imagem) — fica em aberto, precisa de mais print rolando a página pra confirmar.

## O que NÃO aparece aqui

- `SHOE HEIGHT` — não apareceu, consistente (accessories não é calçado)

## Correção no modelo de backend

A regra que tínhamos era: `Men's/Women's/Kid's Size → visible_when: familia = calcado`. Esse print mostra que está **errada** ou **incompleta**. A hipótese mais forte agora é:

> O filtro de tamanho não depende da categoria em si, depende de **se existe algum produto no resultado atual com variantes de tamanho cadastradas daquele tipo (masculino/feminino/infantil)**.

Ou seja, em vez de uma regra fixa tipo `visible_when: familia = calcado`, faz mais sentido essa faceta ser **calculada dinamicamente** igual Brands/Activity/Color já são (ver [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md), passo de contagem por faceta): só aparece se a contagem de produtos com aquele tipo de tamanho for maior que zero no contexto de filtro atual. Isso é mais simples de manter do que ficar cadastrando "família" pra cada categoria nova — e explica por que apareceu em Accessories sem estar na lista de "calçado".

Vou deixar essa correção registrada aqui; ainda preciso confirmar se `Shoe Height` segue mesmo restrito por família ou se também seria melhor calculado assim — depende de mais prints (ex.: ver se Shoe Height aparece em Apparel/Accessories quando algum produto ali também tiver essa característica, o que é pouco provável mas vale checar).
