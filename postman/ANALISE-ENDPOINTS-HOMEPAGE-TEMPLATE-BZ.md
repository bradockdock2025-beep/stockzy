# Análise de Endpoints — Homepage (template "BZ" enviado pelo front)

> Este documento mapeia **cada seção de produto/catálogo do template de UI/UX enviado**
> (print da homepage "BZ — Curated Fashion. Every Style.") para os endpoints do backend que
> já existem hoje, lidos direto do código-fonte. Escopo: só endpoints ligados a
> produto/catálogo/merchandising (categorias, marcas, produtos, facetas, hero, tiles).
> Rodapé, newsletter e ícones de utilidade (busca/conta/wishlist/carrinho) ficam fora deste
> documento por não serem negócio de produto. Onde não existe endpoint pronto para a seção
> do print, isso está marcado como **❌ gap**.
>
> Guias complementares já existentes no repo (mais detalhados, com exemplos de resposta
> real testados contra o banco): [`GUIA-INTEGRACAO-HOMEPAGE.md`](./GUIA-INTEGRACAO-HOMEPAGE.md),
> [`GUIA-FILTROS-CATALOGO.md`](./GUIA-FILTROS-CATALOGO.md). Este arquivo é o mapa rápido
> seção-do-print → endpoint; para shape de resposta completo e casos de borda, consulte
> os guias acima.

Base URL local: `http://localhost:3000` (ou a porta configurada em `PORT`).

---

## 1. Menu principal (MEN / WOMEN / FOOTWEAR / ACCESSORIES / NEW ARRIVALS)

| Elemento do print | Endpoint | Status |
|---|---|---|
| Menu: MEN / WOMEN / FOOTWEAR / ACCESSORIES | `GET /categories` | ✅ pronto |
| Menu: NEW ARRIVALS | não é categoria — aponta pra rota que chama `GET /products/new-arrivals` | ✅ pronto (rota estática no front) |

`GET /categories` retorna uma árvore (campos: `id, name, slug, code, familyTag,
bannerTitle, bannerDescription, parentId, children[]`). **Não tem campo de ícone/imagem** —
se o front quiser ícone por categoria no menu, hoje precisa mapear por `slug` no próprio
front (gap, ver seção 6).

---

## 2. Hero banner ("CURATED FASHION. EVERY STYLE.")

### `GET /homepage/hero` — ✅ pronto, com ressalva

```json
{
  "id": "...",
  "desktopImage": "https://.../hero.jpg",
  "mobileImage": null,
  "eyebrow": "HYP Miami",
  "title": "The Curated Standard",
  "ctaLabel": "Find Your Style",
  "ctaHref": "/sneakers",
  "isActive": true
}
```

### ⚠️ Gap: o print mostra um carrossel com paginação ("01 / ...", pontinhos de navegação)

O backend hoje só suporta **um hero ativo por vez** (`heroBanner.findFirst({ where:
{ isActive: true } })` — busca um registro único, não uma lista). Se o front precisa de
múltiplos slides no hero, o endpoint atual não serve para isso; seria necessário o
backend expor `GET /homepage/hero` como lista, ou criar um novo recurso
(`GET /homepage/hero/slides`). Reportar essa necessidade antes de implementar o carrossel.

---

## 3. Strip "FEATURED BRANDS" (Nike, Adidas, New Balance, Puma, Levi's, The North Face, Champion, +More)

### ❌ Gap confirmado — não existe endpoint público de marcas

Não há `GET /brands` público (só existe `brands.admin.controller.ts`, protegido). O nome e
logo da marca só aparecem **aninhados dentro de produto** (`product.brand.name`,
`product.brand.logoUrl`), e só em alguns endpoints de produto (ver seção 4 sobre
`new-arrivals` não trazer `brand`).

**Workaround atual** (o mesmo já documentado em `GUIA-INTEGRACAO-HOMEPAGE.md` seção 7):
buscar 1 produto por marca via `GET /products?brand=<slug>&limit=1` e usar
`data[0].brand.logoUrl`. Isso exige o front saber de antemão a lista de slugs de marca a
mostrar (curadoria manual, hardcoded no front) — não dá pra "descobrir" as marcas em
destaque via API hoje.

**Recomendação para o backend:** expor `GET /brands` (ou `GET /brands/featured`) público,
leve, retornando só `{ id, name, slug, logoUrl }` das marcas ativas/em destaque. Sem isso,
o strip de logos do print não tem como ser alimentado dinamicamente.

---

## 4. Grid "NEW ARRIVALS" (6 produtos)

### `GET /products/new-arrivals?limit=6` — ✅ pronto, com ressalva

Parâmetros aceitos (`QuerySectionDto`): `limit` (1–48), `categoryId` (uuid),
`days` (1–365, default vem de `NEW_ARRIVALS_WINDOW_DAYS` ou 30), `window` (`7d|30d|all`),
`minDiscount`.

```
GET /products/new-arrivals?limit=6
```

### ⚠️ Este endpoint **não devolve `brand`**

Lido direto em `products.service.ts::findNewArrivals` — o `include` do Prisma carrega
`variants`, `images`, `category`, mas não `brand`. Se o card do print precisar mostrar a
marca abaixo do produto, hoje esse endpoint não fornece isso (mesmo achado documentado em
`GUIA-INTEGRACAO-HOMEPAGE.md` seção 8). No print atual a marca não aparece nos cards de
"New Arrivals", então não bloqueia — mas fica registrado caso o design mude.

Cada item vem com `variants[].availableQuantity`, `isAvailable`, `purchaseMode`
(`normal | presale | sold_out | presale_sold_out`) — útil pro estado de "esgotado" no card.

---

## 5. Três tiles "STREETWEAR / CASUAL / FOOTWEAR"

### `GET /homepage/tiles?section=<nome-combinado>` — ✅ pronto (mecanismo genérico)

```json
[
  { "id": "...", "section": "categorias-destaque", "title": "Sneakers",
    "href": "/products?categoryId=...", "imageSrc": "https://...jpg",
    "mobileImageSrc": null, "position": 0, "isActive": true }
]
```

O modelo já existe e é genérico (`section` é texto livre, sem enum fixo no schema). Hoje só
há tiles cadastrados sob `section = "categorias-destaque"` (Sneakers/Apparel/Accessories —
ver `SQL_SEED_HOMEPAGE_HERO_TILES.sql`), que é **outro conjunto de banners**, não o mesmo do
print (Streetwear/Casual/Footwear). Para este bloco do print funcionar, é só popular a
tabela `homepage_tile` com uma nova seção (ex. `section = "lifestyle-tiles"`) e o front
consumir `GET /homepage/tiles?section=lifestyle-tiles` — sem necessidade de mudança de
código, só seed de dado (mesmo padrão do `SQL_SEED_HOMEPAGE_HERO_TILES.sql`).

---

## 6. "SHOP BY CATEGORY" (T-Shirts, Shirts, Hoodies, Jackets, Pants, Shorts, Dresses, Tops)

### `GET /categories` (nomes) + `GET /products?categoryId=...&limit=1` (foto) — ✅ pronto

Correção: reexaminando o print, os 8 quadrados dessa seção **não são ícones genéricos** —
são fotos de produto reais, no mesmo estilo visual dos cards de "New Arrivals"/"Men's
Collection" logo abaixo (alguns até com o coraçãozinho de wishlist por cima). Ou seja, é só
mais uma listagem de produto, uma foto representativa por categoria/garment_type — não uma
peça de conteúdo à parte.

`GET /categories` dá o nome/slug de cada categoria (ver seção 1). A foto de cada quadrado
vem do endpoint de produto normal: `GET /products?categoryId=<id>&limit=1` (ou
`facets=garment_type:...`, se o corte for por garment type) devolve `data[0].image` via
`toListItem()`. Curadoria de *qual* produto representa cada categoria é decisão do
front/admin (ex. o primeiro em destaque), não precisa de campo novo no backend.

---

## 7. "MEN'S COLLECTION" / "WOMEN'S COLLECTION" (grids de 6 produtos)

### `GET /products?facets=gender:men&limit=6` / `GET /products?facets=gender:women&limit=6` — ✅ pronto

Gênero **não é categoria, é faceta** (`facet.key = "gender"`, valores seedados:
`men, women, kids, unisex` — ver `SQL_CATALOG_FACETS_SEED.sql`). O parâmetro genérico de
`QueryProductDto` é `facets`, no formato `"key:val1|val2;key2:val3"`:

```
GET /products?facets=gender:men&limit=6&sort=newest
GET /products?facets=gender:women&limit=6&sort=newest
```

Esse endpoint (`GET /products`, lista geral) **usa o card enxuto com `brand` incluído**
(`toListItem()` → `{ id, name, slug, image, brand: { name, logoUrl }, priceFrom,
featured }`), diferente do `/products/new-arrivals` da seção 4. Outros filtros combináveis:
`categoryId`, `minPrice`/`maxPrice`, `brand` (slug), `inStock`, `belowRetail`, `sort`
(`featured|price_asc|price_desc|newest|relevance`), `search`.

---

## 8. "TOPS & SWEATSHIRTS" (grid de 6 produtos)

### `GET /products?facets=garment_type:tops|sweatshirt&limit=6` — ✅ pronto (mecanismo), ⚠️ confirmar valores

`garment_type` também é uma faceta (não categoria) — confirmado pelos arquivos de seed
`SQL_GARMENT_TYPE_ADD_SWEATPANTS.sql` / `SQL_GARMENT_TYPE_BACKFILL_SWEATPANTS.sql` (facet
`garment_type`, id `42725c8a-c6f3-47e9-8194-0017d308cfce`). O mecanismo de filtro é o mesmo
`facets=` genérico da seção 7. **O que falta confirmar:** quais `value`s exatos existem
hoje para `garment_type` (ex. se "tops" e "sweatshirt" são valores separados ou um único
valor combinado) — consultar `GET /catalog/filters?categoryId=...` (retorna as facets
visíveis com seus `values[]`) antes de fechar a query no front, ou pedir a lista direto ao
backend.

---

## 9. "ACCESSORIES" (grid de 6 produtos)

### `GET /products?categoryId=<id-da-categoria-accessories>&limit=6` — ✅ pronto

Diferente de "Tops & Sweatshirts", **Accessories já é uma categoria real** no catálogo
(mesma usada no tile de `categorias-destaque`: `categoryId =
68cfdb28-6bfe-4ad2-b40c-1af339525322` no ambiente atual — confirmar o id vigente via
`GET /categories`, não hardcodar o UUID acima sem checar). Mesmo endpoint do menu
"ACCESSORIES" do header (seção 1).

---

## 10. Banner full-width "WEAR WHAT MOVES YOU"

### `GET /homepage/tiles?section=<nome-combinado>` — ✅ pronto (mesmo mecanismo da seção 5)

Mesmo modelo genérico de tile; combinar com o time de backend um `section` próprio (ex.
`"banner-cta"`) e popular via SQL, igual ao padrão de `SQL_SEED_HOMEPAGE_HERO_TILES.sql`.
Não precisa de código novo — só seed.

---

## 11. Resumo rápido — todos os endpoints usados neste mapeamento

| Método | Rota | Seção do print |
|---|---|---|
| GET | `/categories` | Menu, Shop by Category (nomes) |
| GET | `/products/new-arrivals` | New Arrivals |
| GET | `/products?facets=gender:men` | Men's Collection |
| GET | `/products?facets=gender:women` | Women's Collection |
| GET | `/products?facets=garment_type:...` | Tops & Sweatshirts, foto de "Shop by Category" |
| GET | `/products?categoryId=...&limit=1` | Accessories, tiles de categoria, foto de "Shop by Category" |
| GET | `/catalog/filters` | descobrir valores válidos de facet (garment_type etc.) |
| GET | `/homepage/hero` | Hero banner (single, sem carrossel) |
| GET | `/homepage/tiles?section=...` | 3 tiles Streetwear/Casual/Footwear, banner "Wear What Moves You" |

## 12. Gaps que precisam de decisão do backend antes do front implementar

Só 2 gaps reais (lista completa com proposta de shape em
[`ENDPOINTS-FALTANTES-HOMEPAGE-BZ.md`](./ENDPOINTS-FALTANTES-HOMEPAGE-BZ.md)):

1. **Hero em carrossel** (seção 2) — hoje é 1 registro só, o print sugere múltiplos slides.
2. **Marcas em destaque** (seção 3) — sem `GET /brands` público, o strip de logos não tem
   como ser dinâmico.

"Shop by Category" (seção 6) **não é gap** — são fotos de produto normais, não ícones.
"Valores válidos de `garment_type`" (seção 8) também não é gap — é só consultar
`/catalog/filters` antes de fechar a query, o endpoint já existe.
