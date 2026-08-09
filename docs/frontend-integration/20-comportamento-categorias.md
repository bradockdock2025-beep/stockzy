# Comportamento das Categorias — guia completo (com a unificação de "Category")

Explicação detalhada de como a árvore de categorias se comporta em cada profundidade, incluindo a decisão recente de unificar subcategoria + tipo de peça sob um único bloco "Category" na sidebar. Todo dado abaixo (nomes, ids conceituais, contagens) reflete o estado real do banco, conferido por leitura direta antes de escrever isto.

---

## 0. A árvore inteira hoje (2 níveis reais, sempre)

Snapshot real, direto do banco. **A árvore de `Category` nunca passa de 2 níveis** (raiz → subcategoria) — nenhum departamento tem um 3º nível de categoria. Qualquer distinção mais fina que isso (T-Shirt dentro de Tops, Handbag dentro de Bags, Low/Mid/High dentro de Sneakers) é resolvida por **faceta**, nunca por mais um nível de `Category` — essa é a regra geral, sem exceção, em qualquer departamento.

```
Accessories
├── Bags                            ← bag_type (facet) aparece quando há produto tagueado
├── Belts
├── Eyewear
├── Face Masks
├── Headwear
├── Home & Lifestyle
├── Jewelry
├── Lanyards & Keychains
├── Other Accessories
├── Tech Accessories
├── Wallets & Card Holders
└── Watches

Apparel  (family_tag: vestuario)     ← garment_type (facet) aparece em QUALQUER subcategoria abaixo
├── Bottoms
├── Dresses
├── Other Apparel
├── Outerwear
├── Tops
└── Undergarments

Collectibles
├── Analog Music
├── Comic Books
├── Figures
├── Food & Consumer Products
├── Homeware
├── Other Collectibles
├── Pins and Keychains
├── Plushes
├── Prints
├── Skate Decks
├── Sports Equipment
└── Toys

Electronics
├── Audio
├── Cellphones
├── Computer and Gaming (Peripherals)
├── Computer Components
├── Gaming Consoles
├── Laptops & Desktops
├── Other Electronics
├── Small Appliances
├── Smartwatches
├── Tablets
└── Video Games

Shoes  (family_tag: calcado)         ← shoe_height (facet) aparece em QUALQUER subcategoria abaixo
├── Boots
├── Cleats
├── Clogs
├── Flats
├── Heels
├── Loafers
├── Oxfords
├── Slides & Sandals
├── Slippers
└── Spikes

Sneakers  (family_tag: calcado)      ← MESMA faceta shoe_height (mesma family_tag de Shoes)
├── Lifestyle
├── Luxury
└── Performance

Trading Cards                        (sem subcategoria, sem faceta de tipo — ainda)
```

**Regra de navegação, em qualquer ponto da árvore:**

| Onde o usuário está | `categories` devolve | `facets` inclui a faceta de tipo? |
|---|---|---|
| Nenhum `categoryId` (raiz) | Os 7 departamentos | Nunca (nenhuma família ativa) |
| `categoryId` = um departamento | Os filhos diretos dele | Sim, se o departamento tiver uma (Apparel/Shoes/Sneakers têm por `family_tag`; Accessories tem `bag_type` sempre presente, só aparece de fato se houver produto; Collectibles/Electronics/Trading Cards não têm nenhuma ainda) |
| `categoryId` = uma subcategoria (folha) | `[]` — não existe 3º nível | Sim, continua igual — a faceta não pertence ao nó da árvore, pertence à família/ao produto |

Note que **Sneakers e Shoes compartilham a mesma faceta** (`shoe_height`, `family_tag: calcado` nos dois) — navegar em qualquer um dos dois departamentos mostra a mesma faceta, com contagem recalculada pro escopo certo. É o mesmo princípio que faz `garment_type` aparecer tanto em "Apparel" quanto em "Tops" especificamente.

---

## 1. A ideia central: uma árvore, dois mecanismos, três profundidades visíveis

Existe **uma única fonte de verdade estrutural**: a tabela `Category`, hierárquica (`parentId`). Mas o que o usuário enxerga como "Category" na sidebar, em alguns departamentos, é a **combinação** de duas coisas diferentes por baixo:

| Mecanismo | O que é | Como se comporta |
|---|---|---|
| `Category` (tabela) | A prateleira física — onde o produto mora | Navegacional: escolher uma categoria troca de página (`categoryId` novo na URL) |
| `Facet` com `visibility: category_family` | Um atributo do produto que só faz sentido dentro de uma família de categorias | Filtrável: marcar um valor não troca de página, refina a mesma listagem (`facets=chave:valor` na URL) |

Isso não é uma regra nova pensada só pra Apparel — **já existe em produção há mais tempo pra Shoes/Sneakers** (`shoe_height`: Low/Mid/High), e agora também pra Apparel (`garment_type`: Jersey/T-Shirt/Hoodie/Polo/Tank Top/Sweater/Jacket/Coat). É o mesmo padrão aplicado duas vezes.

---

## 2. Profundidade 0 — Categorias raiz (departamentos)

Hoje existem **7 categorias raiz** (`parentId: null`):

```
Accessories
Apparel        (family_tag: vestuario)
Collectibles
Electronics
Shoes          (family_tag: calcado)
Sneakers       (family_tag: calcado)
Trading Cards
```

Chamando o filtro **sem `categoryId`**, o campo `categories` da resposta devolve exatamente essa lista:

```
GET /catalog/filters
```
```json
{
  "category": null,
  "categories": [
    { "name": "Accessories", "slug": "accessories", "count": 0 },
    { "name": "Apparel", "slug": "apparel", "count": 71 },
    { "name": "Collectibles", "slug": "collectibles", "count": 77 },
    { "name": "Electronics", "slug": "electronics", "count": 40 },
    { "name": "Shoes", "slug": "shoes", "count": 0 },
    { "name": "Sneakers", "slug": "sneakers", "count": 0 },
    { "name": "Trading Cards", "slug": "trading-cards", "count": 0 }
  ],
  "facets": []
}
```

Nesse nível, `facets` sempre vem vazio — nenhuma faceta com `category_family` se aplica ainda, porque nenhuma categoria específica está ativa (o backend não sabe se o usuário "está" em `vestuario` ou `calcado`, então nenhuma das duas aparece).

---

## 3. Profundidade 1 — Subcategorias (dentro de um departamento)

Ao passar `categoryId` de um departamento, `categories` passa a devolver **os filhos diretos** dele — e é aqui que a faceta com `category_family` (se o departamento tiver uma) **começa a aparecer** em `facets`, porque agora o backend sabe a `family_tag` da categoria ativa.

### Exemplo: `categoryId=<Apparel>`

Resposta **completa e real** (chamada direta ao servidor agora, não exemplo inventado):

```json
{
  "category": { "id": "906bf243-...", "name": "Apparel", "slug": "apparel" },
  "categories": [
    { "id": "26413fcd-...", "name": "Bottoms", "slug": "bottoms", "code": "BOT", "count": 8 },
    { "id": "11300504-...", "name": "Dresses", "slug": "dresses", "code": "DRS", "count": 0 },
    { "id": "8eb86614-...", "name": "Other Apparel", "slug": "other-apparel", "code": "OTH", "count": 1 },
    { "id": "29f15e7a-...", "name": "Outerwear", "slug": "outerwear", "code": "OUT", "count": 10 },
    { "id": "cef20acb-...", "name": "Tops", "slug": "tops", "code": "TOP", "count": 47 },
    { "id": "43b807a1-...", "name": "Undergarments", "slug": "undergarments", "code": "UND", "count": 5 }
  ],
  "brands": [
    { "value": "adidas", "label": "adidas", "count": 24 },
    { "value": "anti-social-social-club", "label": "Anti Social Social Club", "count": 5 },
    { "value": "fear-of-god-essentials", "label": "Fear of God Essentials", "count": 8 }
    /* + 10 outras marcas — 13 no total, cada uma com produto de verdade em Apparel */
  ],
  "facets": [
    {
      "key": "garment_type", "name": "Category", "inputType": "chip",
      "values": [
        { "value": "jersey", "label": "Jersey", "count": 37, "sortOrder": 1 },
        { "value": "t-shirt", "label": "T-Shirt", "count": 8, "sortOrder": 2 },
        { "value": "hoodie", "label": "Hoodie", "count": 5, "sortOrder": 3 },
        { "value": "polo", "label": "Polo", "count": 0, "sortOrder": 4 },
        { "value": "tank-top", "label": "Tank Top", "count": 0, "sortOrder": 5 },
        { "value": "sweater", "label": "Sweater", "count": 0, "sortOrder": 6 },
        { "value": "jacket", "label": "Jacket", "count": 0, "sortOrder": 7 },
        { "value": "coat", "label": "Coat", "count": 0, "sortOrder": 8 }
      ]
    },
    { "key": "gender", "name": "Gender", "inputType": "checkbox", "values": [ "..." ] },
    { "key": "color", "name": "Color", "inputType": "swatch", "values": [ "..." ] },
    { "key": "size_apparel", "name": "Size", "inputType": "chip", "values": [ "..." ] }
  ],
  "priceMin": "99.99",
  "priceMax": "99.99"
}
```

**Campos que faltavam no exemplo anterior:** `brands` (Brand não é uma faceta — é relação própria de `Product.brandId`, mas aparece na sidebar do mesmo jeito, com auto-exclusão igual às facetas) e `priceMin`/`priceMax` (calculado sobre o filtro completo, sem exclusão nenhuma — é o único campo que não segue a regra de auto-exclusão).

**Correção importante sobre uma coisa que eu tinha explicado errado antes:** repare que `garment_type` lista os **8 valores**, incluindo os 5 com `count: 0` (`polo`, `tank-top`, `sweater`, `jacket`, `coat`) — eles **não somem individualmente**. A regra real (`products.service.ts:817`, `if (!counts.some(c => c.count > 0)) continue;`) só descarta a **faceta inteira** se **todos** os valores dela derem zero — mas se pelo menos um valor tiver produto, a faceta aparece **com todos os seus valores**, zerados ou não. Cabe ao frontend decidir se esconde/desabilita visualmente as opções com `count: 0`, mas elas chegam na resposta.

**`brands` é a exceção — segue uma regra diferente de `facets`, de propósito:** o código tem um `.filter(b => b.count > 0)` explícito só pra marca (`products.service.ts:755`), então marca com zero produto **não aparece de jeito nenhum**, nem zerada — diferente de valor de faceta, que aparece zerado e cabe ao frontend esconder. Duas regras distintas, mesma resposta, então não assuma que todo campo se comporta igual só porque `facets` e `brands` moram lado a lado no JSON.

`priceMin`/`priceMax` iguais (`99.99`/`99.99`) só porque hoje todo produto de dev tem o mesmo preço-placeholder — não é bug, é o dado de teste.

### Exemplo: `categoryId=<Sneakers>`

```json
{
  "category": { "name": "Sneakers", "slug": "sneakers" },
  "categories": [ "... filhas de Sneakers, se houver ..." ],
  "facets": [
    {
      "key": "shoe_height", "name": "Shoe Height",
      "values": [
        { "value": "low", "label": "Low", "count": 12 },
        { "value": "mid", "label": "Mid", "count": 4 }
      ]
    }
  ]
}
```

Mesmo mecanismo, outra família (`calcado`), outro nome de faceta (`shoe_height` em vez de `garment_type`), mas **o mesmo comportamento estrutural**.

### Departamentos sem faceta extra

`Accessories`, `Collectibles`, `Electronics`, `Trading Cards` não têm `family_tag` definida — então, dentro deles, `facets` nunca vai incluir uma faceta do tipo "Category". A sidebar, nesses casos, é só a lista de `categories` (Belts, Watches, Jewelry...) — e é assim de propósito: essas subcategorias já são granulares o bastante sozinhas (ver `ANALISE_ESTRUTURA_MEN_WOMEN_SHOP_BY_CATEGORY.md` §5).

---

## 4. Profundidade 2 — dentro de uma subcategoria específica

Ao entrar ainda mais fundo (`categoryId=<Tops>`, por exemplo), duas coisas mudam:

1. `categories` passa a devolver os filhos de **Tops** — hoje, nenhum (Tops não tem subcategoria própria), então vem `[]`
2. `facets` **continua trazendo `garment_type`** — porque a `family_tag` de Tops (`vestuario`) é a mesma de Apparel. A faceta não "pertence" a Tops especificamente, pertence à família inteira, então acompanha o usuário em qualquer nível dentro dela.

```json
GET /catalog/filters?categoryId=<Tops>
```
```json
{
  "category": { "name": "Tops", "slug": "tops" },
  "categories": [],
  "facets": [
    { "key": "garment_type", "name": "Category", "values": [ "... mesmos valores, contagem recalculada só pra Tops ..." ] },
    { "key": "gender", "...": "..." }
  ]
}
```

É por isso que o usuário consegue filtrar "T-Shirt" tanto de dentro de "Tops" quanto de dentro de "Apparel" direto (sem escolher Tops primeiro) — a contagem é recalculada pro escopo certo em cada caso, mas a faceta em si não desaparece.

---

## 5. Como a sidebar une os dois mecanismos num bloco só "Category"

Isto é decisão de **apresentação no frontend**, não um terceiro mecanismo de backend. A regra prática:

```
Bloco "Category" na sidebar =
  1. Renderiza categories[] como linhas de navegação (sem checkbox — clicar troca de página)
  2. Se facets[] tiver um item com key igual a "garment_type" (ou "shoe_height", dependendo
     do departamento), renderiza os values dele logo abaixo, com uma linha divisória
     ("Tipo de peça"), como checkboxes (marcar refina a mesma página)
  3. Um cabeçalho só: "Category"
```

Isso é exatamente o que o demo interativo mostrou (link enviado antes) — clicar num tile de "Shop by Category" e ver a mesma checkbox marcada sozinha na sidebar, com a lista de subcategorias intacta ao lado.

**Chave de leitura pro frontend:** o campo `facets[].key` decide qual faceta é "a de tipo" pra cada departamento — hoje é `garment_type` dentro de Apparel, `shoe_height` dentro de Shoes/Sneakers, e nenhuma dentro de Accessories/Collectibles/Electronics/Trading Cards (nesses, o bloco "Category" é só a lista de `categories`, sem a segunda parte).

---

## 6. Exemplo completo — usuário combinando tudo

Usuário está em Apparel, marcou "T-Shirt" (tipo) e "Black" (cor):

```
GET /products?categoryId=<Apparel>&facets=garment_type:t-shirt;color:black
GET /catalog/filters?categoryId=<Apparel>&facets=garment_type:t-shirt;color:black
```

A sidebar recalcula **cada faceta ignorando o próprio filtro dela** (auto-exclusão, já documentado em `03-catalogo-filtros-busca.md`):
- `garment_type`: mostra a contagem de T-Shirt, Jersey, Hoodie etc. calculada considerando só o filtro de `color:black` (ignora o próprio `garment_type` ativo) — assim o usuário pode trocar de "T-Shirt" pra "Jersey" sem precisar desmarcar antes
- `color`: mostra a contagem de Black, White etc. calculada considerando só `garment_type:t-shirt` (ignora o próprio `color` ativo)
- `categories` (Tops/Bottoms/Outerwear...): contagem considerando os dois filtros juntos

Nenhum desses três cálculos interfere no outro — é assim que a sidebar continua "viva" mesmo com vários filtros simultâneos.

---

## 7. Tabela-resumo — o que cada departamento tem hoje

| Departamento | `family_tag` | Subcategorias (profundidade 1) | Faceta "Category" extra? |
|---|---|---|---|
| Apparel | `vestuario` | Tops, Bottoms, Outerwear, Undergarments, Dresses, Other Apparel | ✅ `garment_type` (8 valores) |
| Sneakers / Shoes | `calcado` | — | ✅ `shoe_height` (Low/Mid/High) |
| Accessories | — | Bags, Belts, Eyewear, Face Masks, Headwear, Home & Lifestyle, Jewelry, Lanyards & Keychains, Other Accessories, Tech Accessories, Wallets & Card Holders, Watches | ✅ `bag_type` (5 valores — ver nota abaixo) |
| Collectibles | — | Figures, Toys, Blind Boxes, Plushes, Homeware, Comic Books, Skate Decks, Pins & Keychains, Prints, Other Collectibles, Analog Music, Sports Equipment, Food & Consumer Products | ❌ |
| Electronics | — | Audio, Cellphones, Computer and Gaming (Peripherals), Computer Components, Gaming Consoles, Laptops & Desktops, Other Electronics, Small Appliances, Smartwatches, Tablets, Video Games | ❌ |
| Trading Cards | — | — | ❌ |

**Nota sobre `bag_type`:** diferente de `garment_type`/`shoe_height` (que usam `visibility: category_family`), `bag_type` usa `visibility: always` — porque Accessories não tem `family_tag` própria (não é uma família só de bolsa; Belts/Watches/Jewelry já são granulares o bastante sozinhas, não precisam da camada extra). Na prática o comportamento pro usuário é idêntico: a faceta só aparece quando há produto com esse tipo tagueado, em qualquer contexto — normalmente isso significa "aparece quando navegando dentro de Bags", pela regra padrão de "esconde se a contagem zerar". Valores: `handbag`, `tote-bag`, `backpack`, `crossbody-bag`, `duffel-bag`. Estrutura já criada (`SQL_BAG_TYPE_FACET_SEED.sql`), mesmo sem produto de bolsa cadastrado ainda — decisão de preparar o domínio antes do dado, não depois.
