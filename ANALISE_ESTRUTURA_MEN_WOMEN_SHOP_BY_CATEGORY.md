# Análise — Estrutura de filtro Men/Women e "Shop by Category"

Baseado no `STORAGES_SAMPLE_UPLOAD/analsie-estudos.md` que você escreveu. Cobre os dois pontos: (1) o que da estrutura Men/Women já está sólido no back vs. o que falta, e (2) a dúvida principal — como "Shop by Category" (T-Shirts, Belts, Bottoms, Jackets & Coats, Sunglasses, Wallets, Watches / Dresses, Handbags, Jewelry, Tops, Tote Bags) deveria ser modelado, já que hoje não existe filtro pra isso.

---

## 1. O que já está sólido — sem ação necessária

| Elemento do documento | Já existe? | Onde |
|---|---|---|
| "Men" / "Women" | ✅ | Faceta `gender` (valores `men`, `women`, `kids`, `unisex`) — filtra com `facets=gender:men` |
| Category: Apparel, Sneakers, Accessories, Shoes, Collectibles, Electronics | ✅ | 6 das 7 categorias raiz já existem (falta só confirmar se "Sneakers" separado de "Shoes" é intencional — já é assim hoje) |
| Activity (Running, Basketball, Skateboarding, Soccer, Hiking, Golf, Football) | ✅ | Faceta `activity`, valores idênticos aos que você listou |
| Color | ✅ | Faceta `color`, mesma lista (+ `silver`, adicionado no lote de Electronics) |
| Price (por faixa) | ✅ | `minPrice`/`maxPrice` em `/products`, `/catalog/filters`, `/search` |

Nada disso precisa de trabalho — é só usar o que já documentei em `docs/frontend-integration/03-catalogo-filtros-busca.md`.

---

## 2. A pergunta principal — "Shop by Category"

**Resposta curta: não precisa de mecanismo novo.** Cada item de "Shop by Category" já é ou uma **categoria existente**, ou um **valor da faceta `garment_type`** (a mesma que criamos pro lote de jerseys — ver `ANALISE_MAPEAMENTO_PLP_JERSEYS.md`). Não é uma dimensão de filtro nova, é só uma vitrine de atalhos que já usa os dois mecanismos que o sistema já tem.

### Lado Accessories — mapeamento direto pra categoria já existente

| Shop by Category | Nossa subcategoria (Accessories) | slug |
|---|---|---|
| Belts | Belts | `belts` |
| Watches | Watches | `watches` |
| Wallets | Wallets & Card Holders | `wallets-card-holders` |
| Sunglasses | Eyewear | `eyewear` (mais amplo que só "sunglasses", mas cobre) |
| Jewelry (Women) | Jewelry | `jewelry` |
| Handbags / Tote Bags (Women) | Bags | `bags` (hoje não distingue "handbag" de "tote bag" — ver §4) |

Pra essas, o link do "Shop by Category" é simplesmente `GET /products?categoryId=<id-de-belts>`, etc. — zero trabalho de backend, só o frontend montar os links certos.

### Lado Apparel — mapeamento pra categoria OU pra `garment_type`

| Shop by Category | Como resolver |
|---|---|
| Bottoms | Já é categoria (`Apparel > Bottoms`) — `categoryId` direto |
| Tops (Women) | Já é categoria (`Apparel > Tops`) — `categoryId` direto |
| T-Shirts | Já é valor de `garment_type` (criamos no lote de jerseys: `t-shirt`) — `categoryId=Tops&facets=garment_type:t-shirt` |
| Jackets & Coats | 🟡 Temos a categoria `Outerwear`, que cobre isso de forma ampla. Se quiser a granularidade "jaqueta" vs "casaco" separada, precisa de valores novos em `garment_type` (`jacket`, `coat`) — hoje só tem `jersey/t-shirt/hoodie/polo/tank-top/sweater` |
| Dresses (Women) | ❌ **Lacuna real** — não existe categoria nem valor de `garment_type` pra vestido. Precisa decidir: categoria nova (`Apparel > Dresses`) ou valor novo de `garment_type` dentro de uma categoria existente |

---

## 3. Recomendação de modelagem

Sigo a mesma regra que já usamos nos jerseys: **categoria = onde o produto mora fisicamente na prateleira** (Tops/Bottoms/Outerwear/Accessories/Bags/etc.), **`garment_type` = o que o produto É dentro dessa prateleira** (jersey, t-shirt, hoodie, jacket, dress...).

Sugestão concreta pros gaps encontrados:
1. Adicionar `jacket` e `coat` como novos valores de `garment_type` (mesma faceta, só mais valores — não precisa de faceta nova)
2. Para "Dresses": como é uma peça de corpo inteiro, sem "prateleira" óbvia entre Tops/Bottoms — duas opções, sua escolha:
   - (a) Nova subcategoria `Apparel > Dresses`
   - (b) Vestido é só mais um valor de `garment_type` dentro de `Other Apparel` (categoria que já existe, catch-all)
3. Para diferenciar "Handbags" de "Tote Bags" dentro de `Bags`: mesma lógica, um valor de `garment_type` novo (`handbag`, `tote-bag`) escopado à categoria `Bags` — mas isso só vale a pena se você já tiver produtos suficientes de bolsa pra precisar diferenciar; com poucos itens, a categoria `Bags` sozinha já resolve.

Nenhuma dessas mudanças precisa de tabela nova nem de conceito novo — é tudo dado dentro do sistema de `Facet`/`FacetValue` e `Category` que já existe.

---

## 4. Marcas — auditoria de cobertura

Comparei sua lista (~58 marcas únicas, Men e Women repetem a mesma lista) contra o que já está cadastrado no banco real (58 marcas hoje, mas nem todas as suas):

**Já cadastradas** (16 da sua lista): adidas, Aime Leon Dore, Alexander McQueen, AMIRI, Anti Social Social Club, Arc'teryx, ASICS, Awake, Balenciaga, BAPE, Billionaire Boys Club, Birkenstock, Bottega Veneta, Brain Dead, Crocs, The North Face, Timberland, UGG, Yeezy, Puma, Saint Laurent.

**Faltando** (~35 da sua lista): Bad Bunny, Brooks, Burberry, Cactus Jack, Cactus Plant Flea Market, Canada Goose, Carhartt, Casablanca, Casio, Chrome Hearts, Clarks, Comme des Garçons, Converse, Corteiz, Denim Tears, Diadora, Diesel, Trapstar, Under Armour, Undercover, Vans, Versace, Virgil Abloh, Yohji Yamamoto, YoungLA, Reebok, Represent, Revenge, Rhude, Rick Owens, Salomon, Saucony, Seiko, Skechers, Sp5der, Stone Island. ("Travis Scott" e "Saint Mxxxxxx" ficam de fora de propósito — não são marcas próprias catalogáveis, mesmo critério já usado nos lotes de produto: aparecem como colaboração no nome do produto, não como `Brand` cadastrada.)

**Recomendação:** não cadastrar essas ~35 marcas agora sem produto nenhum atrelado — ficariam vazias na loja (mesmo problema que "Popular Brands" já sinalizou no `ANALISE_MAPEAMENTO_HOMEPAGE_TEMPLATE.md`). Faz mais sentido cadastrar cada uma junto com o lote de produto real dela, do jeito que fizemos até agora (marca só entra quando tem imagem/produto de verdade pra vincular).

---

## 5. Aprofundando — como isso vira filtro de verdade, não só link estático

Você tem razão em cobrar isso, e a resposta merece ser mais concreta. Vou separar dois momentos diferentes da experiência do usuário, porque são dois problemas de UX distintos, e o sistema já tem (ou quase tem) os dois mecanismos certos pra cada um — só faltou eu explicar como eles se encaixam.

### Momento 1 — "Acabei de chegar, quero navegar direto pro que eu quero" (descoberta)

Isso é o grid de tiles clicáveis (o "Shop by Category" como está na sua captura — ícone + rótulo, tipo "T-Shirts", "Watches"). É **navegação de entrada**, antes de qualquer filtro ativo. Isso já tem endpoint pronto: `GET /homepage/tiles?section=...` (`10-conteudo-institucional.md`) — o mesmo mecanismo já usado no `ANALISE_MAPEAMENTO_HOMEPAGE_TEMPLATE.md` pra "Staff Picks"/"Seasonal Favorites". Cada tile é só `{title: "T-Shirts", imageSrc, href}`, e o `href` já vem pronto com o filtro embutido:

```
Tile "T-Shirts" → href: /produtos?categoryId=<id-Tops>&facets=garment_type:t-shirt
Tile "Watches"  → href: /produtos?categoryId=<id-Watches>
Tile "Dresses"  → href: /produtos?categoryId=<id-Apparel>&facets=garment_type:dress   (depois de decidir onde Dresses mora)
```

Clicar no tile não é "outra coisa" — já cai direto na mesma PLP filtrada que o usuário chegaria filtrando manualmente. Não existe filtro duplicado, é literalmente a mesma URL que o filtro monta.

### Momento 2 — "Já estou navegando, quero refinar por tipo de peça" (dentro da PLP)

Aqui é onde a faceta `garment_type` entra — e ela **já aparece dinamicamente na sidebar hoje**, sem precisar de nada novo, pelo mesmo motivo que `color` e `activity` já aparecem: `GET /catalog/filters` devolve **todas** as facetas ativas e visíveis pro contexto, com contagem — `garment_type` é uma delas desde que criamos ela pros jerseys.

Ponto que talvez não tenha ficado claro na análise anterior: como `garment_type` tem `visibility: category_family` com `visibility_value: 'vestuario'` (a tag que `Apparel` **e todas as subcategorias dela** compartilham), ela aparece no filtro **em qualquer nível da árvore de Apparel** — não só dentro de "Tops". Ou seja, se o usuário está vendo `Apparel` inteiro (sem entrar em nenhuma subcategoria ainda), a sidebar já mostraria:

```json
{
  "category": { "name": "Apparel" },
  "categories": [
    { "name": "Tops", "count": 22 },
    { "name": "Bottoms", "count": 7 },
    { "name": "Outerwear", "count": 9 },
    { "name": "Undergarments", "count": 4 }
  ],
  "facets": [
    {
      "key": "garment_type", "name": "Category",
      "values": [
        { "value": "t-shirt", "label": "T-Shirt", "count": 12 },
        { "value": "jersey", "label": "Jersey", "count": 37 },
        { "value": "hoodie", "label": "Hoodie", "count": 6 }
      ]
    }
  ]
}
```

**Isso já é exatamente a "navegação direta e dinâmica" que você está pedindo** — o usuário marca a checkbox "T-Shirt" e o resultado filtra na hora, contagem real, sem precisar entrar em "Tops" primeiro. O que falta não é mecanismo, é só **dado**: hoje `garment_type` só tem 6 valores (`jersey, t-shirt, hoodie, polo, tank-top, sweater`), faltam os que aparecem no seu documento (`jacket`, `coat`, `dress`, e o que mais fizer sentido pro catálogo real).

### E o lado Accessories (Belts, Watches, Wallets, Jewelry)?

Aqui o raciocínio é o oposto, e é o motivo de eu ter separado os dois grupos na análise anterior: essas **já são categorias específicas o suficiente** pra não precisarem de uma camada de faceta em cima. "Belts" já é o nível de granularidade final — não existe "tipo de cinto" que faça sentido filtrar dentro de Belts do jeito que "tipo de top" faz sentido dentro de Tops (que mistura jersey/camiseta/moletom/regata, coisas visualmente e funcionalmente diferentes). Pra Accessories, o bloco `categories` do `/catalog/filters` (filhos diretos da categoria ativa, com contagem) **já cumpre o mesmo papel dinâmico** que `garment_type` cumpre pra Apparel — é o mesmo tipo de filtro "dinâmico com contagem", só que resolvido no nível de categoria em vez de faceta, porque a granularidade da categoria já é suficiente aqui.

**Resumo da lógica**: a pergunta certa não é "isso é uma faceta ou um link estático", é "esse nível de detalhe já existe como categoria, ou preciso de uma camada extra dentro da categoria?". Apparel precisa da camada extra (`garment_type`) porque "Tops" é ampla demais pra ser o filtro final. Accessories não precisa, porque "Belts"/"Watches"/"Jewelry" já são o filtro final.

---

## Resumo — o que fazer, se você aprovar

| # | Ação | Tipo |
|---|---|---|
| 1 | Nada — gender/category/activity/color/price já prontos | — |
| 2 | Confirmar: sidebar de filtro já é dinâmica hoje (`garment_type` + `categories` com contagem) — não precisa construir nada novo pra isso funcionar | — |
| 3 | Criar os `HomepageTile` do grid "Shop by Category" (Men e Women), `href` de cada um já apontando pro filtro certo | `POST /admin/homepage/tiles` × 13 (uma vez decidido o texto/imagem de cada) |
| 4 | ~~Adicionar `jacket`/`coat` em `garment_type`~~ — **decidido e gerado**: `SQL_DRESSES_CATEGORY_AND_GARMENT_TYPE_EXPANSION.sql` | Feito |
| 5 | ~~Decidir onde "Dresses" mora~~ — **decidido**: nova subcategoria `Apparel > Dresses` (mesmo critério que já separa Tops de Bottoms — forma de peça, não "tipo dentro de Tops") | Feito, SQL gerado no mesmo arquivo acima |
| 6 | ~~Decidir se separa Handbags/Tote Bags~~ — **revisto**: tipo de item é estrutura de domínio, não dado de fornecedor como marca — deve estar pronto antes do produto, não depois (correção do usuário, ver `docs/frontend-integration/20-comportamento-categorias.md` §7). Criada faceta `bag_type` (`SQL_BAG_TYPE_FACET_SEED.sql`) mesmo sem produto de bolsa ainda | Feito |
| 7 | ~35 marcas faltando | Não cadastrar ainda — só junto com produto real de cada uma |

Nada foi alterado no banco — isso é só a análise.
