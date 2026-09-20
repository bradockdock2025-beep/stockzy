# Endpoints que faltam — Homepage (template "BZ")

> Recorte de [`ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md`](./ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md):
> só o que **ainda não existe** no backend para o novo template de homepage enviado pelo
> front, restrito a endpoints de negócio de produto/catálogo (sem rodapé/newsletter/chrome
> de utilidade). As demais seções do print (New Arrivals, Men's/Women's Collection, Tops &
> Sweatshirts, Accessories, tiles de lifestyle, banner CTA) já têm endpoint pronto hoje —
> não estão aqui porque não é gap, é só consumir o que já existe (ver o documento acima).

---

## 1. `GET /brands` (ou `/brands/featured`) — não existe

**Seção do print:** strip "FEATURED BRANDS" (Nike, Adidas, New Balance, Puma, Levi's, The
North Face, Champion, +More).

**Situação hoje:** só existe `brands.admin.controller.ts`, protegido por auth de admin. Não
há nenhuma rota pública de marcas. Nome/logo de marca só aparecem aninhados dentro de
produto (`product.brand.name/logoUrl`), e mesmo assim só em alguns endpoints de produto —
não dá pra "listar marcas" via API hoje de jeito nenhum.

**Proposta:**

```
GET /brands              → todas as marcas ativas
GET /brands/featured     → só as marcadas como destaque (se existir esse conceito no admin)
```

Resposta enxuta sugerida:

```json
[
  { "id": "...", "name": "Nike", "slug": "nike", "logoUrl": "https://..." }
]
```

**Bloqueia:** o strip de logos do print não tem como ser dinâmico sem isso — hoje só dá
pra fazer via workaround manual (buscar 1 produto por marca, slug a slug, hardcoded no
front).

---

## 2. Hero com múltiplos slides — não existe

**Seção do print:** banner principal ("CURATED FASHION. EVERY STYLE.") com indicador de
paginação ("01 / ...") e pontinhos de navegação, sugerindo carrossel.

**Situação hoje:** `GET /homepage/hero` faz `heroBanner.findFirst({ where: { isActive:
true } })` — busca **um único registro**, o model não suporta mais de um hero ativo
simultâneo.

**Proposta:** ou o endpoint atual passa a devolver uma lista (`GET /homepage/hero` →
`HeroBanner[]` em vez de objeto único, mudança breaking), ou cria-se um recurso novo em
paralelo:

```
GET /homepage/hero/slides → HeroBanner[], ordenados por alguma posição/ordem
```

Mesma estrutura de campos que já existe hoje por slide (`desktopImage, mobileImage,
eyebrow, title, ctaLabel, ctaHref, isActive`), só adicionando um campo de ordenação
(`position`, no padrão já usado em `HomepageTile`).

**Bloqueia:** sem isso o hero do print fica travado em 1 slide fixo, sem o carrossel.

---

## Correção: "SHOP BY CATEGORY" **não é gap**

Reexaminando o print: os 8 quadrados de "T-Shirts, Shirts, Hoodies, Jackets, Pants,
Shorts, Dresses, Tops" **não são ícones genéricos** — são fotos de produto reais (mesmo
estilo visual dos cards de "New Arrivals"/"Men's Collection" logo abaixo, alguns até com o
coraçãozinho de wishlist por cima). Ou seja, essa seção é só mais uma listagem de produto
(uma foto representativa por categoria/garment_type), não uma peça de conteúdo à parte.

Isso **não precisa de campo novo em `Category`** — dá pra resolver com o que já existe:
`GET /products?categoryId=<id>&limit=1` (ou por `facets=garment_type:...`, se o corte for
por garment type e não por categoria) devolve `data[0].image`, que já é a foto do produto
via `toListItem()`. Curadoria de *qual* produto representa cada categoria fica a critério
do front/admin (ex. o primeiro em destaque), não do endpoint.

---

## Resumo

| # | Endpoint/campo faltante | Seção do print | Esforço aproximado |
|---|---|---|---|
| 1 | `GET /brands` (público) | Featured Brands | novo controller/service simples, dado já existe na tabela `brand` |
| 2 | Hero com múltiplos slides | Hero banner | mudança de shape (lista) ou endpoint novo `/homepage/hero/slides` |
