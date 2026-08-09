# Estrutura da Página — StockX /browse/men (Listagem "Men")

Página de listagem de produtos (PLP) filtrada por gênero. Serve tanto para uma categoria de gênero (Men/Women/Kids) quanto, pelo padrão visual, provavelmente é o mesmo template usado para qualquer categoria (Sneakers, Apparel etc.) — só muda o filtro raiz aplicado.

## 1. Header (fixo, topo do site — reaparece em todas as páginas)

**Linha 1:**
- Logo "StockX" (verde)
- Barra de busca central: "Search for brand, color, etc."
- Menu direita: Listings | News | About | Help | Sell | Sign Up / Login

**Linha 2 — navegação de categorias:**
- ☰ All, Trending, New, **Deals** (destacado em vermelho — indica seção promocional), Men, Women, Kids, Sneakers, Shoes, Apparel, Accessories, Collectibles, Trading Cards, Mystery Boxes (badge "New"), More

Ou seja, o menu principal mistura dois tipos de link: **gênero** (Men/Women/Kids) e **tipo de produto** (Sneakers/Shoes/Apparel/...) no mesmo nível — ambos levam a esta mesma página de listagem, só troca o filtro.

## 2. Banner introdutório da categoria

- Bloco cinza com título "Men" (H1)
- Parágrafo curto de texto SEO/institucional (ex.: "Fashion and products for men are all the rage these days...")
- Link "Read More" (texto expansível — provavelmente para SEO, conteúdo indexável sem poluir a UI)

## 3. Breadcrumb + Ordenação

- Breadcrumb: `Gender / Men` (mostra o caminho de filtro aplicado, não uma hierarquia fixa de categoria)
- Alinhado à direita: dropdown "Sort Featured" (ordenação: featured, preço, mais recentes etc.)

## 4. Sidebar de Filtros (coluna esquerda, sticky)

**Toggles rápidos (switches on/off):**
- Available Now
- Xpress Ship
- Below Retail

**Filtros em acordeão (expansível/colapsável):**
- **CATEGORY** (aberto por padrão neste print): Apparel, Sneakers, Accessories, Shoes, Collectibles, Electronics
- **BRANDS** (colapsado)
- **ACTIVITY** (colapsado)
- **COLOR** (colapsado)
- **PRICE** (colapsado, provavelmente range slider)

### Detalhe — anatomia do componente de filtro "CATEGORY" (acordeão)

- Título "CATEGORY" em caixa alta, negrito, fonte maior que os itens da lista
- Ícone de seta/chevron alinhado à direita do título, apontando para cima (^) quando expandido — clicável, colapsa/expande a seção inteira
- Lista de opções abaixo do título, cada uma como texto simples clicável (sem checkbox visível, sem contador de itens ao lado):
  - Apparel
  - Sneakers
  - Accessories
  - Shoes
  - Collectibles
  - Electronics
- Espaçamento vertical generoso entre os itens (lista solta, fácil de escanear/tocar)
- Cada item da lista provavelmente funciona como link de filtro único (troca a categoria aplicada) e não como multi-seleção por checkbox — coerente com a mesma taxonomia de "Category" vista no mega menu ([CONCEPT.md](CONCEPT.md))

### Detalhe — anatomia do componente de filtro "BRANDS" (acordeão)

- Mesmo padrão visual do título: "BRANDS" em caixa alta, negrito, chevron para cima (expandido) à direita
- **Diferença importante em relação a CATEGORY:** aqui cada item tem um **checkbox quadrado** à esquerda — indica **multi-seleção** (dá pra filtrar por várias marcas ao mesmo tempo), diferente de CATEGORY que era link simples de seleção única
- Lista em **ordem alfabética**, sem agrupamento por letra dentro deste painel (o agrupamento A-C/D-F/... só aparece no mega menu, aqui é lista corrida): adidas, Aime Leon Dore, Alexander McQueen, AMIRI, Anti Social Social Club, Arc'teryx, ASICS, Awake, Balenciaga, BAPE, Billionaire Boys Club, Birkenstock, Bottega Veneta, Brain Dead...
- Lista longa e scrollável (corta no fim do card visível) — provavelmente tem busca/"ver mais" mais abaixo, não capturado neste print
- Espaçamento vertical igual ao de CATEGORY, mantendo consistência entre os filtros da sidebar

Isso confirma um padrão de UI: **filtros de valor único** (ex.: Category) usam lista de links; **filtros de múltiplos valores combináveis** (ex.: Brands, provavelmente também Activity e Color) usam checkbox.

### Detalhe — anatomia do componente de filtro "ACTIVITY" (acordeão)

- Mesmo padrão visual e de componente de BRANDS: título "ACTIVITY" em caixa alta + chevron para cima, itens com **checkbox quadrado** à esquerda (multi-seleção)
- Lista curta, cabe inteira sem scroll (7 itens), **não está em ordem alfabética** — parece ordenada por relevância/popularidade: Running, Basketball, Skateboarding, Soccer, Hiking, Golf, Football
- Mesmos valores já vistos no mega menu em "Shop By Activity" para Sneakers/Shoes ([CONCEPT.md](CONCEPT.md)) — confirma que é a mesma faceta reaproveitada como filtro de sidebar
- Confirma o padrão: quando a lista de opções é curta/fixa (Activity, Color), fica sem ordenação alfabética e sem necessidade de busca/scroll; quando é longa e cresce (Brands), vem em ordem alfabética e scrollável

**Estado marcado (checkbox selecionado):** ao clicar em uma opção (ex.: "Running"), o quadrado deixa de ser vazio/contornado e vira **preto sólido com um check branco** dentro — mesmo padrão de checkbox comum, só que preenchido em preto (não na cor verde usada em outros pontos do site). Confirma que é multi-seleção de verdade (dá pra marcar Running e também Basketball ao mesmo tempo, cada um vira preto independente).

No backend, marcar "Running" faz o frontend adicionar `activity[]=running` na chamada de `GET /products` e em `GET /catalog/filters` (ver [BACKEND-ENDPOINT-PRODUCTS.md](BACKEND-ENDPOINT-PRODUCTS.md)) — o grid recarrega só com produtos marcados com essa atividade, e os outros filtros (Brands, Color, contagens) se recalculam considerando esse novo filtro aplicado.

### Detalhe — anatomia do componente de filtro "COLOR" (acordeão)

- Título "COLOR" em caixa alta + chevron para cima, mesmo padrão dos demais
- **Foge do padrão de lista/checkbox dos outros filtros**: aqui é um **grid de swatches** (amostras de cor), 4 colunas x 3 linhas = 12 opções
- Cada opção é um círculo colorido sólido, com o nome da cor centralizado embaixo (Black, White, Multi, Blue, Grey, Red, Yellow, Brown, Pink, Purple, Green, Orange)
- "Multi" é representado por um círculo com gradiente arco-íris (para produtos multicoloridos/estampados, não uma cor única)
- "White" é o único círculo com contorno fino (para ficar visível sobre fundo branco)
- O swatch "Grey" aparece com um **anel/borda extra ao redor** (contorno verde) — indica **estado selecionado** desse filtro (provavelmente é só o exemplo do print, e não reflete produtos reais)
- Seleção parece ser por clique direto no círculo (não por checkbox) — provavelmente também permite múltipla seleção, só que com feedback visual de anel em vez de check

### Detalhe — anatomia do componente de filtro "PRICE" (acordeão)

- Título "PRICE" em caixa alta + chevron para cima, mesmo padrão dos demais
- Componente é um **range slider de faixa dupla** (dois "puxadores" circulares brancos com borda verde) sobre uma barra horizontal
- Trecho selecionado da barra (entre os dois puxadores) fica verde escuro; o restante da barra fica cinza claro — feedback visual do intervalo ativo
- Abaixo de cada puxador, um **tooltip/label fixo em fundo preto** mostra o valor numérico correspondente: `$0` (mínimo) e `$6750` (máximo, reflete o preço mais alto do catálogo/categoria atual — é dinâmico, não fixo)
- Não há campos de texto para digitar valor exato neste print — só arraste dos puxadores
- É o único filtro numérico/contínuo da sidebar; todos os outros (Category, Brands, Activity, Color) são categóricos

### Detalhe — filtro exclusivo da página /browse/kids: "AGE GROUP"

Quando o gênero aplicado é **Kids**, a sidebar ganha um filtro a mais que não existe em Men/Women: **AGE GROUP**.

- Mesmo padrão visual dos demais: título em caixa alta + chevron para cima
- Itens com **checkbox quadrado** (multi-seleção, mesmo componente de Brands/Activity)
- Lista curta e fixa, 4 opções, **em ordem de idade decrescente** (não alfabética): Child, Preschool, Toddler, Infant
- É o único filtro visto até agora que só aparece **condicionado a um valor específico de outra faceta** (Gender = Kids) — nenhum outro filtro da sidebar depende de outro pra existir

Resumo dos 4 padrões de filtro encontrados na sidebar:
1. **Lista de link simples** (seleção única) → Category
2. **Lista com checkbox** (multi-seleção, texto) → Brands, Activity
3. **Grid de swatch visual** (multi-seleção, cor) → Color
4. **Range slider de faixa dupla** (intervalo numérico) → Price

Percebe-se que os filtros da sidebar batem exatamente com as "facets" descritas no mega menu (Gender/Activity/Product Type/Color) documentadas em [CONCEPT.md](CONCEPT.md) — a navegação do menu e os filtros da PLP usam o mesmo modelo de atributos.

## 5. Grid de Produtos (conteúdo principal)

- Grid de **4 colunas**, várias linhas (paginado)
- Mistura tipos de produto na mesma listagem: sneakers, slides, apparel (camisetas, jerseys), acessórios (óculos, relógios), colecionáveis (action figures não vistas aqui, mas categoria presente no filtro) — tudo dentro do filtro "Men"

### Anatomia de cada card de produto:
- Ícone de "favoritar" (coração) no canto superior direito
- Imagem do produto (fundo neutro/branco, produto centralizado, sem modelo/pessoa)
- Ícone pequeno da marca antes do nome, em alguns cards (ex.: logo Nike) — aparece principalmente em itens "Sponsored"
- Nome do produto (1-2 linhas, trunca)
- Linha secundária variável — ou:
  - Tamanho específico (ex.: "US M 10.5"), quando o card é de um listing/oferta específica; ou
  - Label "Lowest Ask", quando o card representa o produto de forma agregada (menor preço entre todos os tamanhos)
- Preço principal (grande, negrito) = menor preço disponível
- Preço secundário menor, com "incl." + ícone de info (ⓘ) = preço com taxas/frete incluído — mostra o preço "cru" (ask) e o preço "tudo incluso" lado a lado
- Badges/tags abaixo do preço:
  - "Xpress Ship" (ícone de raio/envio) — indica envio rápido, produto já em estoque no hub StockX
  - "Sponsored" (ícone) — item de anúncio/patrocinado misturado organicamente na grid

**Padrão importante:** produtos patrocinados aparecem intercalados na 2ª e 5ª linha do grid, sem separação visual forte além do texto "Sponsored" — modelo de ads nativo dentro do grid orgânico.

## 6. Paginação

- Números de página: `1 2 3 4 … 25` + seta "próxima"
- Confirma que a listagem é paginada (não infinite scroll)

## 7. Faixa de confiança/institucional (3 colunas, antes do footer)

- **Shop with Confidence** — sobre verificação StockX
- **Buyer Promise** — garantia ao comprador
- **Start Selling ASAP** — CTA para vendedores, reforça o modelo two-sided (compra e venda)

## 8. Footer

- Logo "StockX."
- Colunas de link por **marca** (Air Jordan, Adidas, New Balance, Nike, ASICS) + coluna "Popular Releases" — cada uma lista os produtos/linhas mais buscados daquela marca (bom para SEO)
- Segunda leva de colunas por **categoria**: Collectibles, Apparel, Accessories — e colunas institucionais: About, Sell, Help
- Badges de app (App Store, Google Play)
- Barra final: seletor de país/idioma/moeda (United States | English | $ USD), ícones sociais (X, Facebook, Instagram, YouTube), links legais (Terms, Privacy, Guidelines, Your Privacy Choices), copyright, toggle de tema claro/escuro

## Leitura para o nosso projeto

- O mesmo template de PLP parece servir para qualquer filtro raiz (gênero, categoria, marca) — sugere uma **página de listagem genérica** parametrizada por filtro, não uma página por categoria.
- O grid mistura tipos de produto muito diferentes (sneaker, camiseta, óculos, relógio) na mesma listagem — o "card de produto" precisa ser um componente genérico o suficiente para qualquer categoria, com campos condicionais (tamanho vs. lowest ask, badges opcionais).
- Preço duplo (ask vs. incl. fees) é um padrão de marketplace de revenda (leilão/bid-ask) — como somos marca própria com preço fixo, provavelmente **não precisamos desse padrão**, só um preço único (com ou sem parcelamento).
- "Sponsored" inserido no grid orgânico é um padrão de monetização de marketplace multi-vendedor — não se aplica a uma marca privada vendendo produção própria.
