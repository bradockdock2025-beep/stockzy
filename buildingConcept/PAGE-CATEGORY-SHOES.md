# Estrutura da Página — StockX /category/shoes (filtros)

Comparação direta com [PAGE-CATEGORY-SNEAKERS.md](PAGE-CATEGORY-SNEAKERS.md), já que são as duas categorias de calçado do site.

## Ordem completa da sidebar em /category/shoes

`CATEGORY` → `GENDER` → `BRANDS` → `SHOE HEIGHT` → `ACTIVITY` → `COLOR` → `PRICE` → `MEN'S SIZE` → `WOMEN'S SIZE` → `KID'S SIZE`

**É exatamente a mesma lista de filtros, na mesma ordem, que `/category/sneakers`.** Não tem filtro novo aqui — o "acrescentado" nessa página é só o **conteúdo** do filtro CATEGORY, que muda pra refletir as subcategorias de Shoes em vez das de Sneakers.

## O único ponto diferente: CATEGORY

Em `/category/sneakers`, CATEGORY mostrava: Sneakers (atual) + Lifestyle, Performance, Luxury.

Em `/category/shoes`, CATEGORY mostra: **Shoes** (atual, em negrito) + as subcategorias dela:
- Slides & Sandals
- Cleats
- Boots
- Clogs
- Loafers
- Slippers
- Heels
- Oxfords
- Flats
- Spikes

Essa lista bate exatamente com "Shop By Product Type" de Shoes no mega menu, já documentado em [CONCEPT.md](CONCEPT.md) (Boots, Cleats, Clogs, Flats, Heels, Loafers, Oxfords, Sandals, Slides & Sandals, Slippers, Spikes).

## Por que isso é uma confirmação importante pro backend

Isso valida a regra de "família calçado" que já tínhamos criado em [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md) (tabela `facet_rules`): Sneakers e Shoes são **categorias diferentes**, mas pertencem à mesma família pra fins de quais facetas aparecem — as duas mostram GENDER, SHOE HEIGHT, MEN'S/WOMEN'S/KID'S SIZE. Só o conteúdo de CATEGORY (as subcategorias) muda, porque isso vem da árvore de categoria, não da regra de visibilidade de faceta.

Ou seja, no `facet_rules`, a condição `visible_when: categoria pertence à família "calçado"` não precisa checar `category = sneakers` OU `category = shoes` uma por uma — dá pra marcar as duas categorias com uma tag comum (ex.: `familia: calcado`) no cadastro de `Category`, e a regra de faceta só checa essa tag. Assim, se no futuro entrar uma categoria nova de calçado, ela já herda o filtro certo sem precisar mexer na regra.
