# Backend para a página /browse/men — Endpoints necessários

Baseado em [PAGE-BROWSE-MEN.md](PAGE-BROWSE-MEN.md). Aqui é o que o backend precisaria expor (endpoints) pra essa página funcionar, e o que cada um devolveria.

## 1. `GET /categories`

Alimenta o menu principal do header e a lista do filtro CATEGORY (é a mesma chamada usada nos dois lugares).

Devolve: lista de categorias com `id`, `nome`, `slug`, `categoria_pai` (se for subcategoria) e `quantidade_de_produtos`.

## 2. `GET /categories/men` (ou `/categories/{slug}`)

Alimenta o banner ("Men" + texto descritivo) e o breadcrumb.

Devolve: `nome`, `texto_descricao`, `caminho_breadcrumb` (ex.: "Gender / Men").

## 3. `GET /catalog/filters?category=men`

Alimenta a sidebar inteira (Brands, Activity, Color, Price) — **precisa receber os filtros já aplicados** e devolver só as opções que fazem sentido pra esse resultado (é assim que Brands/Activity/Color mudam conforme você já filtrou outra coisa).

Parâmetros: os mesmos filtros que o usuário já selecionou (`category`, `brand[]`, `activity[]`, `color[]`, `price_min`, `price_max`).

Devolve:
- `brands`: lista de marcas com produto disponível nesse contexto (nome + quantos produtos)
- `activities`: lista de atividades disponíveis (nome + quantos produtos)
- `colors`: lista de cores disponíveis (nome + cor hex + quantos produtos)
- `price_range`: `{ min: 0, max: 6750 }` — calculado na hora com base nos produtos do filtro atual

## 4. `GET /products`

O endpoint principal — alimenta o grid de produtos e a paginação.

Parâmetros:
- `category` (ex.: men)
- `brand[]`, `activity[]`, `color[]` (múltiplos valores)
- `price_min`, `price_max`
- `available_now`, `xpress_ship`, `below_retail` (true/false — os 3 toggles)
- `sort` (featured, price_asc, price_desc, newest)
- `page`, `per_page` (ex.: 52)

Devolve:
- `products`: lista de produtos, cada um com `id`, `nome`, `imagem`, `marca`, `preco` (ou `preco_a_partir_de` se tiver variação de tamanho), `tamanho` (se aplicável), `patrocinado` (true/false)
- `paginacao`: `{ pagina_atual, total_paginas, total_produtos }`

## 5. `GET /products/{id}`

Detalhe de um produto (usado quando clica no card — não capturado nesta página, mas necessário pra ela fazer sentido).

Devolve: dados completos do produto + lista de variantes (tamanho, preço, estoque de cada uma).

## 6. `POST /favorites/{productId}` e `DELETE /favorites/{productId}`

Alimenta o ícone de coração no card. Precisa de usuário autenticado.

## 7. `GET /brands/popular` e `GET /products/popular`

Alimenta as colunas do footer (Air Jordan, Adidas, New Balance, Nike, ASICS + Popular Releases).

Devolve: lista curta de marcas/produtos mais buscados/vendidos.

## Resumo — quem alimenta o quê

| Parte da tela | Endpoint |
|---|---|
| Menu topo + filtro Category | `GET /categories` |
| Banner + Breadcrumb | `GET /categories/{slug}` |
| Filtros Brands/Activity/Color/Price | `GET /catalog/filters` |
| Grid de produtos | `GET /products` |
| Paginação | dentro da resposta de `GET /products` |
| Ordenação (Sort Featured) | parâmetro `sort` em `GET /products` |
| Favoritar (coração) | `POST/DELETE /favorites/{id}` |
| Footer (marcas/produtos populares) | `GET /brands/popular`, `GET /products/popular` |

## Observação sobre o que não vamos precisar (por sermos marca própria)

- Não precisa de `patrocinado` como leilão de anúncio entre vendedores — se existir destaque pago, é mais simples (campo fixo tipo "em destaque: sim/não").
- `preco` do produto é um valor só (não "ask" + "incl. fees"), a não ser que a gente queira mostrar preço à vista e parcelado.
- `available_now` / `xpress_ship` fazem sentido pra nós como "em estoque" / "envio rápido" — dá pra manter.
