# Estrutura da Página — StockX /category/apparel (filtros, por inferência de padrão)

**Aviso importante:** diferente dos outros arquivos de página, este aqui **não foi construído a partir de um print da própria página** — não recebi imagem de `/category/apparel`. É uma extrapolação baseada no padrão já confirmado em Sneakers/Shoes ([PAGE-CATEGORY-SNEAKERS.md](PAGE-CATEGORY-SNEAKERS.md), [PAGE-CATEGORY-SHOES.md](PAGE-CATEGORY-SHOES.md)) e nos facets do mega menu de Apparel já documentados em [CONCEPT.md](CONCEPT.md). Tudo aqui está marcado como **confirmado** (já visto em algum print) ou **inferido** (dedução por padrão, ainda sem print pra bater o olho).

## O que já sabemos de Apparel pelo mega menu (confirmado em CONCEPT.md)

- Shop By Gender: Men's, Women's, Unisex, Kids' Apparel
- Shop By Activity: Basketball Apparel, Hiking Apparel (lista curta, bem menor que a de Sneakers)
- Shop By Product Type: Bottoms, Other Apparel, Outerwear, Tops, Undergarments
- Shop By Color: existe (mesmo padrão de 4 facets repetido em Sneakers/Shoes/Apparel/Accessories)

## Sidebar esperada de /category/apparel, por extrapolação do padrão

`CATEGORY` → `GENDER` → `BRANDS` → `ACTIVITY` → `COLOR` → `PRICE`

- **CATEGORY** (inferido, alta confiança): mostra "Apparel" em negrito + subcategorias = Bottoms, Other Apparel, Outerwear, Tops, Undergarments — mesmo comportamento contextual já confirmado em Sneakers e Shoes
- **GENDER** (inferido, alta confiança): aparece igual a `/category/sneakers`, porque aqui também o gênero não vem fixo pela URL — checkbox Men, Women, Kids, Unisex
- **BRANDS** (inferido, alta confiança): mesmo componente universal já visto em todo lugar
- **ACTIVITY** (inferido, alta confiança): checkbox, mas lista **mais curta** que a de Sneakers — só Basketball, Hiking (bate com o mega menu)
- **COLOR** (inferido, alta confiança): mesmo grid de swatch
- **PRICE** (inferido, alta confiança): mesmo slider

## O que NÃO deve aparecer aqui (por não pertencer à família "calçado")

- **SHOE HEIGHT** — não deveria aparecer (é exclusivo da família calçado, ver regra em [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md))
- **MEN'S / WOMEN'S / KID'S SIZE** (grade numérica de calçado) — não deveria aparecer aqui do jeito que apareceu em Sneakers/Shoes

## O ponto em aberto — falta confirmar

Roupa normalmente tem filtro de tamanho também, só que **tamanho de roupa (P/M/G/GG ou XS-XXL), não tamanho de calçado**. É bem provável que exista um filtro tipo `APPAREL SIZE` ou `SIZE` na sidebar de `/category/apparel`, só que **isso ainda não apareceu em nenhum print que você mandou** — não vou inventar as opções desse filtro.

**Preciso de um print da sidebar de `/category/apparel` (rolando até o fim) pra confirmar:**
1. Se existe um filtro de tamanho de roupa, e qual o nome dele
2. Quais são os valores exatos (XS/S/M/L ou numérico)
3. Se o componente visual é grid de botão (como Size de calçado) ou outra coisa

## Leitura pro backend (se a hipótese se confirmar)

Se existir mesmo um filtro de tamanho de roupa, o modelo de "família" já criado em [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md) escala bem: adiciona uma tag `familia: vestuario` no cadastro de Category (Apparel entra nela), e uma regra nova `Apparel Size → visible_when: familia = vestuario` — mesmo mecanismo usado pra calçado, só trocando a família e o conjunto de valores do tamanho.
