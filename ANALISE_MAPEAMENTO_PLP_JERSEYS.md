# Mapeamento — PLP "Apparel / Tops / Jerseys" (StockX) → Backend

Análise da página de listagem enviada (`stockx.com/category/apparel/tops/jerseys`) cruzando com o que já existe no backend. Conferido contra o servidor real rodando (`localhost:3000`), não só contra código — os números abaixo (facetas, contagens) são o estado **atual de verdade** do banco.

Também explorei a pasta que você indicou: `STORAGES_SAMPLE_UPLOAD/storage-clothes-tshir-jersy_files/` — é uma página salva do Chrome (`.htm` + pasta `_files`) da PLP de jerseys real da StockX. Dentro dela tem **39 imagens de produto reais** (jerseys de futebol majoritariamente: adidas seleções nacionais, Nike x colabs, Supreme, Palace x Nike, Kith x adidas, Travis Scott x Nike x Barcelona, etc.), prontas pra virar produtos de exemplo, no mesmo padrão do `STORAGES/` original. **Não usei nada disso ainda** — só confirmando que os dados existem e onde estão, caso você queira seguir com isso depois.

---

## Correção importante antes de tudo

**"Jersey" não é categoria — é tipo de peça.** Errei isso na primeira versão desta análise (tratei como se precisasse virar um 3º nível de categoria, `Apparel → Tops → Jerseys`). Categoria é a prateleira física (Tops, Bottoms, Outerwear...); "Jersey" é uma característica do produto dentro de "Tops", no mesmo grupo de "T-Shirt", "Hoodie", "Polo", "Regata" — ou seja, é exatamente o papel que uma **Facet** já cumpre no sistema (igual `color`, `activity`, `size_apparel`), não o papel de `Category`.

A StockX de verdade modela isso como categoria na URL deles (`/category/apparel/tops/jerseys`) — mas isso é a arquitetura interna deles, não uma obrigação pra cá. Aqui o sistema já foi desenhado pra resolver "tipo de peça" via faceta, e é isso que se deve seguir.

## 1. O essencial: endpoint é o mesmo de sempre

Essa página **não precisa de endpoint novo, nem de categoria nova**. Continua sendo `Apparel → Tops` (2 níveis, já existe), filtrado por uma faceta de tipo de peça:

```
GET /products?categoryId=<id-de-Tops>&facets=garment_type:jersey&sort=featured&page=1&limit=32
GET /catalog/filters?categoryId=<id-de-Tops>&facets=garment_type:jersey
```

`garment_type` é um nome sugerido (ver seção 3) — não existe ainda, precisa ser criado.

---

## 2. Filtros da sidebar — mapeamento faceta por faceta

Testei `GET /catalog/filters?categoryId=<id-de-Tops>` contra o servidor real pra ver o que já existe hoje nessa árvore (Apparel → Tops):

| Filtro no template | Existe hoje? | Onde |
|---|---|---|
| **Available Now** (toggle) | ✅ | `inStock=true` (`02-produtos.md`) |
| **Xpress Ship** (toggle) | ❌ | Não existe conceito de "envio expresso" no backend — mesma lacuna já identificada no `ANALISE_MAPEAMENTO_HOMEPAGE_TEMPLATE.md` |
| **Below Retail** (toggle) | ✅ | `belowRetail=true` — **o próprio código já usa esse nome exato** (`price < compareAtPrice`), coincidência boa, é literalmente a mesma regra |
| **Category** (mostrado como "Jerseys" no template) | ❌ | Não é categoria — é a faceta de tipo de peça que falta criar. Ver seção 3 |
| **Gender** (Men/Kids/Women/Unisex) | ✅ Já existe, com `unisex` incluso | Testado ao vivo: `{"key":"gender","values":[men,women,kids,unisex]}` |
| **Brands** | ✅ | Mecanismo de `Brand` + auto-exclusão já funciona |
| **Activity** (Soccer, Basketball, Skateboarding, Football, Golf) | ✅ Já cadastrado, **zero produtos ainda usando** | Faceta `activity` já existe no seed (`SQL_CATALOG_FACETS_SEED.sql:24`) com `running, basketball, skateboarding, soccer, hiking, golf, football` — bate quase exatamente com o template (o template mostra um subconjunto porque está filtrado pra jerseys). Some da resposta hoje só porque nenhum produto tem esse facet value atribuído ainda (regra "zerou, some") |
| **Season** (FW18, SS18, FW17...) | ❌ | Não existe faceta de temporada/coleção no backend hoje — não está em nenhum lugar do `SQL_CATALOG_FACETS_SEED.sql` |
| **Color** (swatches) | ✅ | Faceta `color` já tem quase as mesmas cores do template (`black, white, multi, blue, grey, red, yellow, brown, pink, purple, green, orange`) |
| **Price** | ✅ | `minPrice`/`maxPrice` |
| **Men's Size / Women's Size / Kid's Size** (3 filtros separados) | 🟡 Parcial — ver seção 4 | Hoje existe só **uma** faceta `size_apparel` unificada (XS–XXL), não dividida por gênero |

---

## 3. Faceta de tipo de peça — precisa ser criada (não a categoria)

Não existe hoje (`grep` em `SQL_CATALOG_FACETS_SEED.sql` por `type`/`garment`/`style` não devolve nada). Seguindo exatamente o padrão já usado pra `size_apparel` — que também é uma faceta só visível dentro de roupa, via `visibility: category_family` + `visibilityValue: 'vestuario'` (a `familyTag` que `Apparel` e suas subcategorias já têm, confirmei antes: `Apparel (familyTag=vestuario)`):

```sql
-- Facet
INSERT INTO facets (id, key, name, input_type, scope, visibility, visibility_value, sort_order, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'garment_type', 'Category', 'chip', 'product', 'category_family', 'vestuario', 15, true, now(), now());

-- Valores (Jersey + os outros tipos de "Tops" que já aparecem nos produtos cadastrados: hoodie, t-shirt, etc.)
INSERT INTO facet_values (id, facet_id, value, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), f.id, v.value, v.label, v.sort_order, true, now()
FROM facets f
CROSS JOIN (VALUES
  ('jersey','Jersey',1),
  ('t-shirt','T-Shirt',2),
  ('hoodie','Hoodie',3),
  ('polo','Polo',4),
  ('tank-top','Tank Top',5),
  ('sweater','Sweater',6)
) AS v(value, label, sort_order)
WHERE f.key = 'garment_type'
ON CONFLICT (facet_id, value) DO NOTHING;
```

Chamei de `garment_type` só como sugestão de nome estável (`key`) — o `name` de exibição pode ser "Category" mesmo, pra bater visualmente com o rótulo do template ("CATEGORY" na sidebar), mesmo não sendo uma `Category` de verdade por baixo. `scope: product` porque o tipo de peça é do produto inteiro, não varia por variante (diferente de `color`/`size`, que são por variante).

Cada produto de jersey recebe esse `facetValueIds` (valor "jersey") na criação (`POST /admin/products`, campo `facetValueIds` do produto — não da variante —, ver `14-admin-catalogo.md`), continuando dentro da categoria `Tops` normalmente — **a categoria do produto não muda**, só ganha essa faceta a mais.

O breadcrumb do template ("Home / Apparel / Tops / Jerseys") também muda de leitura com essa correção: os 3 primeiros níveis (`Home / Apparel / Tops`) vêm da árvore de categoria de verdade; o último segmento ("Jerseys") é o **valor da faceta ativa**, não mais um nível de categoria — o frontend monta isso combinando a categoria (`GET /categories`, subindo por `parentId`) com o `label` do facet value selecionado (já vem pronto em `GET /catalog/filters`).

---

## 4. Tamanho de roupa por gênero — decisão de produto, não só técnica

Isto é o ponto mais importante da análise. Hoje:

- **Tênis/calçado**: já dividido — `size_men`, `size_women`, `size_kids` (3 facetas separadas, `SQL_CATALOG_FACETS_SEED.sql:27-29`)
- **Roupa (apparel)**: uma faceta só — `size_apparel` (`SQL_CATALOG_FACETS_SEED.sql:30`), XS a XXL, sem separação por gênero

O template de jerseys mostra **3 filtros separados** (Men's Size, Women's Size, Kid's Size), cada um com seu próprio grid de tamanhos (o de homem/mulher vai até 5XL/4XL, o de criança é menor). Pra bater 100% com esse template, seria preciso o mesmo tratamento que já existe pro calçado: dividir `size_apparel` em `size_apparel_men` / `size_apparel_women` / `size_apparel_kids` (ou nomes equivalentes).

**Isso não é uma correção de bug — é uma decisão de escopo.** A faceta única (`size_apparel`) já funciona tecnicamente (filtra roupa por tamanho igual) — só não reproduz visualmente a divisão em 3 seções do template. Vale decidir antes de mexer: manter simples (1 faceta) ou replicar o padrão do calçado (3 facetas)?

---

## 5. Grid de produto e paginação

Sem novidade — mesmo formato de `GET /products` já documentado (`02-produtos.md`): card enxuto (`id, name, image, brand, priceFrom, featured`), paginação `{data, meta: {total, page, limit, totalPages}}`. A paginação numerada do rodapé (`1 2 3 4 ... 25`) é renderizada pelo frontend a partir de `meta.totalPages`.

O rótulo "Lowest Ask" do template (preço de tênis/colecionável no modelo de leilão da StockX) não existe no nosso modelo de negócio — aqui é venda direta com `price` fixo (`priceFrom` no card), não lance. Isso é esperado (produto próprio, não marketplace peer-to-peer) e já está refletido em como o card é montado — não é uma lacuna, é uma diferença de modelo de negócio intencional.

---

## 6. "Recently Viewed" (rodapé da página)

✅ Mapeamento direto: `GET /catalog/recently-viewed`, já documentado em `19-recomendacoes.md`. Precisa que o frontend já esteja chamando `POST /products/:id/view` nas páginas de produto pra essa seção ter dado real.

---

## Resumo — o que falta pra essa página específica funcionar 100% como o template

| # | Lacuna | Tipo |
|---|---|---|
| 1 | Faceta de tipo de peça (`garment_type`, valor "jersey") | Nova faceta — não existe, precisa ser criada (**não é categoria nova**, ver correção no topo) |
| 2 | Faceta "Season" (FW18/SS18/...) | Dado + decisão — não existe, precisa ser criada do zero (`CreateFacetDto`, ver `14-admin-catalogo.md`) se o negócio quiser esse filtro |
| 3 | Divisão de tamanho de roupa por gênero (Men's/Women's/Kid's Size) | Decisão de produto — hoje é 1 faceta única, template quer 3 |
| 4 | "Xpress Ship" | Conceito ausente — mesma lacuna já registrada na análise da homepage |
| 5 | Produtos de fato tagueados com `activity` | Dado — a faceta já existe, só falta uso: nenhum produto tem valor de `activity` atribuído ainda |

Nada disso exige mudança de arquitetura — são registros de dados (categoria, facet values, tag de produto) e uma decisão de escopo (item 3). As 39 imagens de jersey já disponíveis em `STORAGES_SAMPLE_UPLOAD/storage-clothes-tshir-jersy_files/` cobririam bem um lote inicial de produtos pra essa categoria, quando/se você quiser seguir com isso.
