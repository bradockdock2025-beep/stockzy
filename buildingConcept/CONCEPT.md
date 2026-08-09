# Conceito — Ecommerce Marca Privada (Inspiração StockX)

## Visão Geral
- Não é um marketplace global multi-marca, é uma marca própria (private label).
- Inspiração: https://stockx.com/
- Fase atual: levantamento de conceito e organização de referências (sem código ainda).

## Estrutura de Itens (baseado nas imagens de referência enviadas pelo usuário)

### Referência 1 — Mega Menu "Categories" do StockX

O menu é uma navegação em cascata (colunas horizontais), com até 4 níveis de profundidade. Cada nível abre a coluna seguinte ao passar o mouse/clicar.

**Nível 1 (raiz do menu):**
- Categories
- Brands

**Nível 2 (dentro de Categories) — as categorias-mãe:**
- Sneakers
- Shoes
- Apparel
- Accessories
- Collectibles
- Electronics
- Trading Cards

**Nível 3 — para Sneakers, Shoes, Apparel e Accessories, o padrão se repete com os mesmos 4 "facets" (filtros/dimensões):**
- Shop By Gender
- Shop By Activity
- Shop By Product Type
- Shop By Color

Isso indica que essas 4 categorias compartilham o mesmo **modelo de atributos/facetas** no backend (provavelmente os mesmos campos de metadata em todo produto de moda/calçado).

**Nível 4 — valores de cada faceta, por categoria:**

*Sneakers:*
- Gender: Men, Women, Kids, Unisex
- Activity: Basketball, Football, Golf, Hiking, Running, Skateboarding, Soccer Sneakers
- Product Type: Lifestyle, Luxury Sneakers, Performance
- Color: Black, Blue, Brown, Green, Grey, Orange, Pink, Purple, Red, White, Yellow

*Shoes:* (estrutura idêntica a Sneakers, troca só o nome)
- Activity: Basketball, Football, Golf, Hiking, Running, Skateboarding, Soccer Shoes
- Product Type: Boots, Cleats, Clogs, Flats, Heels, Loafers, Oxfords, Sandals, Slides & Sandals, Slippers, Spikes
- Color: mesma lista de 11 cores

*Apparel:*
- Gender: Men's, Women's, Unisex, Kids' Apparel
- Activity: Basketball Apparel, Hiking Apparel (lista mais curta que Sneakers/Shoes)
- Product Type: Bottoms, Other Apparel, Outerwear, Tops, Undergarments

*Accessories:*
- Gender: Men's, Women's, Unisex, Kids' Accessories
- Activity: Basketball Apparel, Hiking Apparel (aparenta reaproveitar a mesma lista de Apparel — possível taxonomia compartilhada/bug de origem)
- Product Type: Bags, Belts, Eyewear, Face Masks, Headwear, Home & Lifestyle, Jewelry, Lanyards & Keychains, Other Accessories, Tech Accessories, Wallets & Card Holders, Watches

**Collectibles — estrutura diferente (sem os 4 facets acima), vai direto para subcategorias de produto:**
- Analog Music, Comic Books, Figures, Food & Consumer Products, Homeware, Other Collectibles, Pins and Keychains, Plushes, Prints, Skate Decks, Sports Equipment, Toys
- "Homeware" abre um nível 4 próprio: Art, Books, Candles, Chairs, Clocks, Rugs

**Electronics — também foge do padrão de facets, vai direto para tipo de produto:**
- Audio, Cellphones, Computer and Gaming (Peripherals), Computer Components, Gaming Consoles, Laptops & Desktops, Other Electronics, Small Appliances, Smartwatches, Tablets, Video Games
- Subníveis (nível 4):
  - Audio → Ear Phones, Headphones, Speakers
  - Computer and Gaming → Gaming Controllers, Gaming Headsets, Keyboards, Mice, Microphones, Mouse Pads, Virtual Reality
  - Computer Components → Graphics Cards (GPU), Storage and SSD, Processors (CPU), Memory (RAM)
  - Small Appliances → Hair Care, Kitchen Appliances

**Trading Cards** — categoria listada mas sem detalhe capturado nas imagens.

### Referência 2 — Mega Menu "Brands" do StockX

Estrutura mais simples, 3 níveis, organizada **alfabeticamente** (não por categoria):

- Nível 2: agrupadores alfabéticos — 0-9, A-C, D-F, G-I, J-L, M-O, P-R, S-U, V-X, Y-Z
- Nível 3: lista de marcas dentro de cada faixa de letras (ex.: A-C → A Ma Maniere, A.P.C., Acne Studios, adidas, Aime Leon Dore, Alexander McQueen, Alexander Wang, Ambush...; Y-Z → Y-3, Yeezy, YETI, Yohji Yamamoto, Zellerfeld...)

Ponto interessante: a lista de "marcas" mistura marcas de moda (Nike-like), artistas/designers (Daniel Arsham, Virgil Abloh, Pharrell Williams, KAWS-like), franquias/IP (Disney, Marvel, Pokémon, Magic: The Gathering), fabricantes de eletrônicos (Samsung, AMD, JBL) e até selos musicais/pessoas (J Balvin). Ou seja, "Brand" no backend do StockX é um conceito amplo = **qualquer entidade que pode assinar/co-criar um produto**, não só marca de roupa.

### Leitura para o nosso backend (hipótese de modelo de dados)

A navegação sugere uma estrutura assim:
- **Category** (árvore, N níveis): Category → Subcategory → ... — nem toda categoria tem a mesma profundidade nem os mesmos facets.
- **Facets/Atributos por categoria**: Gender, Activity, Product Type, Color são campos de metadata do produto, usados tanto para navegação quanto para filtro. Categorias diferentes (moda vs. eletrônicos vs. colecionáveis) têm conjuntos de facets diferentes — não é um modelo único genérico.
- **Brand**: entidade separada da árvore de categorias, muitos-para-muitos com produtos, indexada alfabeticamente para navegação própria.

Como somos marca privada (não marketplace), provavelmente **não precisamos do nível "Brands"** como um catálogo de terceiros — mas o conceito de facets por categoria (Gender/Activity/Type/Color) continua muito relevante para organizar o catálogo próprio.

