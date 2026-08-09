# Plano — resolver a ausência de Categories

> Gerado em 2026-07-26. `SQL_FULL_SCHEMA.sql` já rodou no banco real — a tabela `categories` existe, mas está vazia. Nada mais avança sem ela: `Product.categoryId` é FK obrigatória, o SKU precisa de `category.code`, e a regra `category_family` (Shoe Height, Size) depende de `Category.familyTag`. Este documento não gera nenhum dado — só organiza as decisões que faltam antes de eu (ou você) criar a primeira categoria.
>
> **✅ RESOLVIDO em 2026-07-26** — ver `PROPOSTA_ESTRUTURA_CATEGORIAS.md` (confirmada) e `SQL_CATEGORIES_SEED.sql` (gerado e validado). Você ainda precisa rodar o SQL manualmente no banco real.

---

## 1. Por que isso bloqueia tudo

| Onde | Dependência de Category |
|---|---|
| `Product.categoryId` | FK obrigatória — não existe produto sem categoria |
| Geração de SKU (`getSkuContext`) | Precisa de `category.code` (categoria) **e** `category.parent.code` (departamento) — sem os dois, `POST /admin/products` falha com "Category codes are required for SKU generation" |
| `Facet.visibility = category_family` (Shoe Height, e qualquer faceta futura do tipo) | Só aparece se `Category.familyTag` bater com o `visibilityValue` da faceta |
| `GET /catalog/filters` sem `categoryId` | Mostra as categorias-raiz (`parentId = null`) — sem elas, a navegação principal fica vazia |
| `GET /catalog/banner?categoryId=` | Sem categoria, sem banner de `/category/{slug}` |

---

## 2. Estrutura de dados já pronta (não precisa de código novo)

`CreateCategoryDto`/`UpdateCategoryDto` já aceitam:
- `name`, `slug` — obrigatórios
- `code` — opcional, mas **obrigatório na prática** se você for gerar SKU automático (ver seção 1)
- `parentId` — opcional, define a árvore (categoria sem `parentId` = raiz/departamento)
- `familyTag` — opcional, string livre (ex.: `"calcado"`, `"vestuario"`) — só precisa bater com o `visibilityValue` de alguma `Facet`
- `bannerTitle`/`bannerDescription` — opcional, texto do banner de `/category/{slug}`

Ou seja: a API já aguenta qualquer estrutura que você definir. O que falta é **a estrutura em si**, que é decisão de negócio, não de código.

---

## 3. Decisões que só você pode tomar

### 3.1 A árvore de categorias
Nos `buildingConcept/*.md` (referência StockX) a estrutura era: `Sneakers`, `Shoes`, `Apparel`, `Accessories`, `Collectibles`, `Electronics`, `Trading Cards` como raízes, cada uma com subcategorias próprias (ex.: Sneakers → Lifestyle/Performance/Luxury; Shoes → Slides & Sandals/Cleats/Boots/...). **Isso é só referência de como a StockX organiza** — não vou assumir que a stockzy usa a mesma árvore. Preciso que você confirme:
- Quais categorias-raiz a stockzy vai ter de fato
- Quais subcategorias cada uma tem (se tiver)
- Isso pode ser exatamente igual ao `buildingConcept`, parecido, ou totalmente diferente — não vou inventar

### 3.2 `code` de cada categoria (pro SKU)
Cada categoria-raiz (departamento) precisa de um código curto (ex.: `SNK` pra Sneakers, `APP` pra Apparel). Subcategorias também precisam do próprio `code` (é o `categoryCode` do SKU; o `departmentCode` vem do pai). Sem isso, `POST /admin/products` falha na hora de gerar SKU automático — dá pra contornar passando `sku` manual no cadastro, mas não é sustentável em escala.

### 3.3 Quais categorias são "família calçado" (ou outra família)
Pra `Shoe Height`/`Men's-Women's-Kid's Size` aparecerem certo nos filtros, toda categoria de calçado (Sneakers, Shoes, e subcategorias delas) precisa de `familyTag: "calcado"` (ou o nome que você quiser — só precisa bater com o `visibilityValue` já cadastrado na faceta `shoe_height`, que hoje é `"calcado"`, ver `SQL_CATALOG_FACETS_SEED.sql`). Se surgir uma família nova (ex. "vestuario" pra um filtro de tamanho de roupa), o `familyTag` é livre — só precisa criar a `Facet` correspondente depois.

### 3.4 Banner (opcional, pode ficar pra depois)
`bannerTitle`/`bannerDescription` por categoria — não bloqueia nada, dá pra deixar em branco e preencher depois.

---

## 4. Como eu proponho resolver, depois que você confirmar a estrutura

Duas formas, sem diferença de resultado — só de conveniência:

**A) Você me passa a lista** (nome, categoria-pai, `code`, `familyTag` onde fizer sentido) e eu gero um `SQL_CATEGORIES_SEED.sql`, no mesmo padrão do `SQL_CATALOG_FACETS_SEED.sql` — idempotente (`ON CONFLICT DO NOTHING`), validado contra Postgres local antes de entregar, você roda manualmente.

**B) Você cria uma por uma via `POST /admin/categories`** — já funciona, sem precisar de mim pra nada.

Recomendo (A) se a árvore já tiver mais de ~5 categorias (mais rápido que ficar chamando a API uma por uma); (B) se for só testar 2-3 categorias primeiro pra validar o fluxo de produto de ponta a ponta antes de definir a árvore inteira.

---

## 5. O que eu preciso de você agora

Só isso, antes de eu gerar qualquer coisa:
1. Lista de categorias-raiz que a stockzy vai ter
2. Pra cada uma: tem subcategoria? quais?
3. Um `code` curto por categoria (raiz e subcategoria)
4. Quais dessas são "calçado" (pra bater com o `familyTag` já usado por `shoe_height` no seed de facets) — ou me avisa se a stockzy nem vai vender calçado, aí essa faceta simplesmente nunca aparece e tudo bem

Não vou gerar nada disso sozinho — é o mesmo motivo de eu ter parado antes de inventar marca ou produto.
