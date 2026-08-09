# Mapa de rotas e filtros — /browse/{gender} vs /category/{category}

Documento de referência única pra não confundir os dois tipos de página. Consolida o que já está detalhado em [PAGE-BROWSE-MEN.md](PAGE-BROWSE-MEN.md) e [PAGE-CATEGORY-SNEAKERS.md](PAGE-CATEGORY-SNEAKERS.md).

## As duas famílias de rota

| | `/browse/{gender}` | `/category/{category}` |
|---|---|---|
| O que fixa a URL | **Gênero** (men, women, kids) | **Categoria** (sneakers, shoes, apparel, accessories, collectibles, electronics, trading-cards) |
| Exemplos | `/browse/men`, `/browse/women`, `/browse/kids` | `/category/sneakers`, `/category/shoes`, `/category/apparel` |
| Endpoint por trás | `GET /products?gender=men...` | `GET /products?category=sneakers...` |
| Breadcrumb | `Gender / Men` | (segue o mesmo princípio: `Category / Sneakers`) |

Os dois caem no **mesmo motor de listagem/filtro** (`GET /products` + `GET /catalog/filters`, ver [BACKEND-ENDPOINT-PRODUCTS.md](BACKEND-ENDPOINT-PRODUCTS.md) e [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md)) — a diferença é só **qual filtro já vem pré-aplicado pela URL**, e isso muda quais facetas a sidebar precisa mostrar.

## Tabela comparativa de filtros da sidebar

| Filtro | `/browse/men` (ou women) | `/browse/kids` | `/category/sneakers` | Observação |
|---|---|---|---|---|
| Available Now / Xpress Ship / Below Retail (toggles) | ✅ | ✅ (assumido, mesmo padrão) | não capturado no print | provavelmente global, presente em toda listagem |
| **CATEGORY** | ✅ lista global (Apparel, Sneakers, Accessories, Shoes, Collectibles, Electronics) | ✅ mesma lista global | ✅ mas mostra **categoria atual + subcategorias** (Sneakers, Lifestyle, Performance, Luxury) | o conteúdo do filtro muda conforme o contexto, não é a mesma lista sempre |
| **GENDER** | ❌ não aparece | ❌ não aparece | ✅ aparece (Men, Women, Kids, Unisex) | some quando o gênero já está fixo na URL; aparece quando não está |
| **BRANDS** | ✅ | ✅ (assumido) | ✅ | mesmo componente nos dois casos |
| **SHOE HEIGHT** | ❌ não visto | ❌ não visto | ✅ (Low, Mid, High) | exclusivo de categoria de calçado |
| **ACTIVITY** | ✅ | ✅ (assumido) | ✅ | mesmo componente nos dois casos |
| **COLOR** | ✅ | ✅ (assumido) | ✅ | mesmo componente nos dois casos |
| **PRICE** | ✅ | ✅ (assumido) | ✅ | mesmo componente nos dois casos |
| **AGE GROUP** | ❌ | ✅ (Child, Preschool, Toddler, Infant) | ❌ não visto | exclusivo de `/browse/kids` |
| **MEN'S / WOMEN'S / KID'S SIZE** | ❌ não visto | ❌ não visto | ✅ (os três juntos, grid de botão) | exclusivo de categoria de calçado; aparecem os 3 ao mesmo tempo porque gênero não está fixo |

"✅ (assumido)" = não apareceu no print específico, mas segue o mesmo padrão já confirmado em outra página — não foi visto com os próprios olhos ainda, então não tratar como 100% certo até aparecer um print confirmando.

## A regra de fundo (por que isso acontece)

Um filtro só aparece na sidebar quando a informação dele **ainda não foi decidida pela URL** e quando ele **faz sentido pro tipo de produto da categoria atual**:

1. **Gender some em `/browse/{gender}`** porque a URL já decidiu isso — não faz sentido perguntar de novo.
2. **Category em `/category/{category}` mostra sub-nível**, porque a URL já entrou na árvore até esse ponto — só mostra o que ainda falta decidir a partir dali.
3. **Shoe Height e os 3 blocos de Size só aparecem em categoria de calçado** — são facets que não existem pra roupa/acessório/colecionável.
4. **Age Group só aparece em `/browse/kids`** — é uma faceta que só faz sentido quando o gênero já é infantil.

Essa regra já tinha sido registrada tecnicamente em [BACKEND-ENDPOINT-CATALOG-FILTERS.md](BACKEND-ENDPOINT-CATALOG-FILTERS.md) (seção "Facetas condicionais") — este documento aqui é só o resumo visual/de produto pra não confundir qual página tem qual filtro.
