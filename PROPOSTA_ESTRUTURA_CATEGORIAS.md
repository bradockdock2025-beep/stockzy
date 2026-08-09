# Proposta — estrutura de categorias da stockzy

> Gerado em 2026-07-26. Diferente do `PLANO_CATEGORIAS.md` (que listava as perguntas em aberto), este arquivo é uma **proposta concreta**, a seu pedido. Base: a árvore de categorias do `buildingConcept/CONCEPT.md` (mega menu StockX), que já é o alicerce de tudo que construímos até aqui — os facets (Gender/Activity/Color), a regra `category_family` (Shoe Height), o `familyTag`. Não é dado inventado do zero: é a mesma referência que já validamos em todas as rodadas anteriores, agora organizada como estrutura de categoria com `code` (pro SKU) e `familyTag` (pra faceta) definidos.

**Isso é uma proposta pra você editar, não uma decisão fechada.** Risque, renomeie, tire ou adicione categoria — depois eu gero o SQL só com o que você confirmar.

> **✅ CONFIRMADO em 2026-07-26** — estrutura aprovada sem alteração. `SQL_CATEGORIES_SEED.sql` gerado (7 categorias-raiz + 53 subcategorias = 60 no total) e validado contra Postgres local descartável: schema completo aplicado, seed rodado, árvore inteira conferida (nenhum órfão, `family_tag` propagado certo pra Sneakers/Shoes/Apparel), seed rodado de novo pra confirmar idempotência (zero duplicata). Ambiente de teste destruído em seguida — nada tocou o banco real.

---

## Critério que usei pra montar isto

- **`code`**: 3 letras pro departamento (categoria-raiz), 3 letras pra subcategoria — vira o SKU `{DEPTO}-{CAT}-{ANO}-{SEQ}` (ex.: `SNK-LFS-2026-000001`)
- **`familyTag`**: só marquei `"calcado"` em Sneakers/Shoes (é o que já está gravado em `SQL_CATALOG_FACETS_SEED.sql` como `visibilityValue` da faceta `shoe_height`) e `"vestuario"` em Apparel (ainda sem faceta correspondente cadastrada — só fica pronta pro dia que você quiser um filtro de tamanho de roupa, não ativa nada sozinha)
- **Accessories não leva `familyTag`** — o filtro de tamanho que aparece lá (`MEN'S SIZE`) é dinâmico (conta por produto, não por família), confirmamos isso na análise do `PAGE-CATEGORY-ACCESSORIES.md`
- Não fui além do nível de subcategoria que os `buildingConcept/*.md` confirmaram — não inventei um 3º nível (ex.: "Homeware → Art/Books/Candles" do Collectibles não entrou, porque não foi confirmado com print, só citado de passagem)

---

## Sneakers (`SNK`) — `familyTag: calcado`

| Subcategoria | `code` |
|---|---|
| Lifestyle | `LFS` |
| Performance | `PRF` |
| Luxury | `LUX` |

## Shoes (`SHO`) — `familyTag: calcado`

| Subcategoria | `code` |
|---|---|
| Slides & Sandals | `SLD` |
| Cleats | `CLT` |
| Boots | `BOT` |
| Clogs | `CLG` |
| Loafers | `LOA` |
| Slippers | `SLP` |
| Heels | `HEE` |
| Oxfords | `OXF` |
| Flats | `FLA` |
| Spikes | `SPK` |

## Apparel (`APP`) — `familyTag: vestuario`

| Subcategoria | `code` |
|---|---|
| Tops | `TOP` |
| Bottoms | `BOT` |
| Outerwear | `OUT` |
| Undergarments | `UND` |
| Other Apparel | `OTH` |

## Accessories (`ACC`) — sem `familyTag`

| Subcategoria | `code` |
|---|---|
| Bags | `BAG` |
| Belts | `BEL` |
| Eyewear | `EYE` |
| Headwear | `HEA` |
| Jewelry | `JEW` |
| Watches | `WAT` |
| Wallets & Card Holders | `WAL` |
| Tech Accessories | `TEC` |
| Face Masks | `MSK` |
| Home & Lifestyle | `HOM` |
| Lanyards & Keychains | `LAN` |
| Other Accessories | `OTH` |

## Collectibles (`COL`) — sem `familyTag`

| Subcategoria | `code` |
|---|---|
| Figures | `FIG` |
| Toys | `TOY` |
| Plushes | `PLU` |
| Comic Books | `COM` |
| Prints | `PRI` |
| Pins and Keychains | `PIN` |
| Skate Decks | `SKA` |
| Sports Equipment | `SPO` |
| Homeware | `HOM` |
| Analog Music | `MUS` |
| Food & Consumer Products | `FOO` |
| Other Collectibles | `OTH` |

## Electronics (`ELE`) — sem `familyTag`

| Subcategoria | `code` |
|---|---|
| Audio | `AUD` |
| Cellphones | `CEL` |
| Tablets | `TAB` |
| Laptops & Desktops | `LAP` |
| Gaming Consoles | `CON` |
| Video Games | `VID` |
| Computer and Gaming (Peripherals) | `PER` |
| Computer Components | `COM` |
| Smartwatches | `SWA` |
| Small Appliances | `APL` |
| Other Electronics | `OTH` |

## Trading Cards (`TRC`) — sem `familyTag`, sem subcategoria
Nenhum dos `buildingConcept/*.md` capturou subcategorias pra Trading Cards (só foi citada como existente no mega menu, sem detalhe). Proponho deixar como categoria única (raiz sem filhos) até você confirmar se tem subdivisão.

---

## Total: 7 categorias-raiz + 52 subcategorias = 59 categorias

## O que eu **não** incluí, de propósito
- **Men/Women/Kids/Unisex** — não é categoria, já é `Facet` (`gender`), já seedado. Confirmamos isso desde `CONCEPT.md`.
- **Brands como categoria** — marca já é `Brand` (entidade própria), não categoria.
- Qualquer subcategoria de nível 3 (ex.: dentro de Homeware) — não tinha confirmação suficiente nos documentos-fonte.

---

## Próximo passo

Se essa estrutura te atende (com ou sem ajuste), eu gero `SQL_CATEGORIES_SEED.sql` — mesmo padrão validado dos outros seeds (idempotente, testado contra Postgres local antes de entregar). Só preciso da sua confirmação (ou das edições que quiser) antes de gerar.
