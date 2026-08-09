# Estrutura da Página — StockX /category/sneakers (filtros exclusivos)

Página de listagem por **categoria** (não por gênero). URL: `stockx.com/category/sneakers` — diferente de `stockx.com/browse/men`. Isso confirma o que já tínhamos concluído em [BACKEND-ENDPOINT-PRODUCTS.md](BACKEND-ENDPOINT-PRODUCTS.md): `gender` e `category` são filtros independentes, cada um com sua própria rota de entrada (`/browse/{gender}` e `/category/{category}`), mas os dois desembocam na mesma listagem/mesmo motor de filtro por trás.

Esse documento cobre só o que é **novo ou diferente** em relação à sidebar já documentada em [PAGE-BROWSE-MEN.md](PAGE-BROWSE-MEN.md).

## 1. Filtro CATEGORY muda de comportamento aqui

Na página Men, CATEGORY mostrava a lista completa do topo: Apparel, Sneakers, Accessories, Shoes, Collectibles, Electronics.

Aqui, dentro de `/category/sneakers`, o filtro CATEGORY mostra:
- **Sneakers** (em negrito — é a categoria atual/ativa)
- Lifestyle
- Performance
- Luxury

Ou seja, o filtro não mostra mais a lista global toda — mostra a **categoria atual + as subcategorias dela** (esses 3 valores batem exatamente com "Shop By Product Type" do mega menu de Sneakers, documentado em [CONCEPT.md](CONCEPT.md)). Isso confirma a hipótese: o filtro CATEGORY é sempre relativo a onde você está na árvore, não uma lista fixa.

## 2. Filtro GENDER (novo aqui, não existia na sidebar de Men)

Faz sentido: na página `/browse/men` o gênero já vem fixo pela própria URL, então não precisa aparecer como filtro. Já em `/category/sneakers` nenhum gênero está pré-aplicado, então GENDER vira só mais um filtro normal da sidebar.

- Mesmo padrão de checkbox (multi-seleção) já visto em Brands/Activity
- Opções: Men, Women, Kids, Unisex

## 3. Filtro SHOE HEIGHT (novo, exclusivo de categorias de calçado)

- Checkbox, multi-seleção, mesmo padrão visual
- Opções: Low, Mid, High
- Não aparece na página Men (que mistura sneaker/apparel/acessório) — é uma faceta específica de calçado, só faz sentido quando a categoria é Sneakers/Shoes

## 4. Filtros de tamanho — um padrão visual novo: "grid de botões"

Aqui aparece um **quinto padrão de filtro** (além de link único, checkbox, swatch e range slider): um grid de **botões retangulares clicáveis**, cada um com o valor do tamanho escrito dentro (não é checkbox, não é swatch — é tipo um "chip" selecionável).

Aparecem **três blocos separados**, um por escala de tamanho, todos com esse mesmo componente visual:

- **MEN'S SIZE**: US M 1 até US M 9.5+ (grid 3 colunas)
- **WOMEN'S SIZE**: US W 2 até US W 10.5+ (grid 3 colunas)
- **KID'S SIZE**: 0C até 9.5C+ (grid 3 colunas — sufixo "C" = children/tamanho infantil)

Ponto importante: **os três blocos aparecem juntos, ao mesmo tempo**, independente de qual opção do filtro GENDER está marcada — diferente do padrão condicional que vimos em "AGE GROUP" (que só aparecia quando `gender=kids` já vinha fixo pela URL). Aqui, como o gênero não é fixo, a página mostra as três tabelas de tamanho lado a lado pra cobrir qualquer combinação que o usuário for montar.

## Resumo — sidebar completa de /category/sneakers

`CATEGORY` (contextual) → `GENDER` (novo) → `BRANDS` → `SHOE HEIGHT` (novo) → `ACTIVITY` → `COLOR` → `PRICE` → `MEN'S SIZE` (novo, botão) → `WOMEN'S SIZE` (novo, botão) → `KID'S SIZE` (novo, botão)

## Atualização nos padrões de filtro identificados

1. Lista de link simples (seleção única) → Category (topo da árvore)
2. Lista com checkbox (multi-seleção, texto) → Brands, Activity, Gender, Shoe Height, Age Group
3. Grid de swatch visual (multi-seleção, cor) → Color
4. Range slider de faixa dupla (intervalo numérico) → Price
5. **Grid de botão/chip retangular (multi-seleção, valor curto)** → Men's/Women's/Kid's Size
