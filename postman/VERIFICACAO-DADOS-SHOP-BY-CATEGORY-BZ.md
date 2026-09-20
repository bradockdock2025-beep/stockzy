# Verificação de dados reais — "SHOP BY CATEGORY" (template BZ)

> Este documento **não é sobre endpoint** — os mecanismos de filtro (categoria e faceta
> `garment_type`) já existem e estão documentados em
> [`ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md`](./ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md).
> Aqui a pergunta é outra: **temos produto real no banco pra cada item do print** (T-Shirts,
> Shirts, Hoodies, Jackets, Pants, Shorts, Dresses, Tops)? Verificado agora, ao vivo, contra
> o banco real via `GET /categories`, `GET /catalog/filters` e `GET /products` no servidor
> local (`localhost:3000`, mesma `DATABASE_URL` de produção).

---

## Resultado — resumo

| Item do print | Tem produto real? | Quantidade | Onde mora hoje | Como consultar reaproveitando o que já existe |
|---|---|---|---|---|
| **T-Shirts** | ✅ sim | ~22 | Categoria `Tops` (identificável pelo nome do produto) | `GET /products?categoryId=<Tops>` — **não** filtrar por `facets=garment_type:t-shirt`, essa tag não está aplicada nos produtos (ver §2) |
| **Hoodies** | ✅ sim | 5 | Categoria `Outerwear` | `GET /products?categoryId=<Outerwear>` (mesmo aviso — não usar `garment_type:hoodie`, count = 0) |
| **Jackets** | ✅ sim | 2 | Categoria `Outerwear` (junto com os hoodies) | `GET /products?categoryId=<Outerwear>` — hoje não dá pra separar jaqueta de hoodie sem reclassificar (ver §2) |
| **Pants** | ✅ sim | 11 (fora sweatpants) + 119 sweatpants | Categoria `Bottoms` | `GET /products?categoryId=<Bottoms>` — sweatpants **já tem** tag (`facets=garment_type:sweatpants`), o resto (track pants, cargo, trousers) não |
| **Shorts** | ✅ sim | 9 | Categoria `Bottoms` (junto com as pants) | `GET /products?categoryId=<Bottoms>` — mesmo aviso, sem tag própria |
| **Tops** | ✅ sim | 32 (categoria inteira) | Categoria `Tops` | `GET /products?categoryId=<Tops>` — é a categoria toda, sem filtro extra necessário |
| **Shirts** (camisa social, diferente de t-shirt) | ❌ não | ~0–1 | — | Não existe produto de camisa social hoje. Único candidato ambíguo: "Foti Long Sleeve Shirt White" (pode ser manga longa em malha, não camisa social) |
| **Dresses** | ❌ não | 0 | Categoria `Dresses` existe (criada em `SQL_DRESSES_CATEGORY_AND_GARMENT_TYPE_EXPANSION.sql`), mas **vazia** | Confirmado com `search=dress` no catálogo inteiro — zero resultado |

> A verificação de dado da seção "Men's Collection" / "Women's Collection" (faceta
> `gender`) é assunto separado, não de "Shop by Category" — ver
> [`VERIFICACAO-DADOS-MENS-WOMENS-COLLECTION-BZ.md`](./VERIFICACAO-DADOS-MENS-WOMENS-COLLECTION-BZ.md).

---

## 1. O que já reaproveitar sem trabalho nenhum

**Tops, T-Shirts, Hoodies, Jackets, Pants, Shorts** — todos têm produto real. A categoria
já resolve 4 dos 6 (Tops fica igual à categoria; Pants e Shorts moram dentro de `Bottoms`;
Hoodies e Jackets moram dentro de `Outerwear`). **Não precisa esperar nada do backend** —
é só o front linkar cada tile direto pra `categoryId`:

```
T-Shirts  → GET /products?categoryId=<Tops>        (ideal: filtrar por nome/curadoria manual, já que a tag garment_type não está aplicada)
Tops      → GET /products?categoryId=<Tops>         (mesma coisa — é a categoria inteira)
Hoodies   → GET /products?categoryId=<Outerwear>    (mistura com Jackets, ver §2)
Jackets   → GET /products?categoryId=<Outerwear>    (mistura com Hoodies, ver §2)
Pants     → GET /products?categoryId=<Bottoms>&facets=garment_type:sweatpants   (só cobre sweatpants)
          → GET /products?categoryId=<Bottoms>      (pra pegar as outras ~11 pants, sem filtro fino)
Shorts    → GET /products?categoryId=<Bottoms>      (mistura com Pants, ver §2)
```

---

## 2. Por que Hoodies/Jackets e Pants/Shorts "misturam" hoje

A faceta `garment_type` **existe com o vocabulário certo** (`jersey, t-shirt, hoodie, polo,
tank-top, sweater, jacket, coat, sweatpants`), mas **só `sweatpants` está de fato aplicada
em produto** (119 produtos com essa tag). Todos os outros valores aparecem no filtro com
`count: 0` — ou seja, o dado existe na tabela `facet_values`, mas não tem nenhuma linha em
`product_facet_values` apontando pra ele, mesmo havendo produto real com esse nome (ex.: 5
produtos com "Hoodie" no nome, mas `garment_type:hoodie` retorna zero).

Isso significa que hoje **categoria é o único filtro que separa esses grupos de verdade**:
`Outerwear` mistura Hoodie + Jacket num balaio só (7 produtos), `Bottoms` mistura Pants +
Shorts + Sweatpants num balaio só (137 produtos). Pra "Shop by Category" mostrar cada tile
com produto **correto** (não só "qualquer coisa de Outerwear"), tem duas saídas:

1. **Curadoria manual no front** (mais rápido): escolher à mão quais produtos de
   `Outerwear`/`Bottoms` entram em cada tile, sem depender de filtro — funciona porque o
   volume é baixo (7 e 137 produtos, dá pra olhar um por um).
2. **Backfill de `garment_type`** (mais correto a médio prazo): rodar o mesmo padrão já
   usado em `SQL_GARMENT_TYPE_BACKFILL_SWEATPANTS.sql` (que tagueou os 119 sweatpants por
   nome de produto) pros valores que faltam — `hoodie`, `jacket`/`coat`, e valores novos pra
   `pants`/`shorts` (que **ainda não existem** na faceta, só `sweatpants` existe do lado de
   Bottoms). Isso já é basicamente o mesmo plano descrito em
   `ANALISE_ESTRUTURA_MEN_WOMEN_SHOP_BY_CATEGORY.md` — só faltou executar o backfill de
   verdade além de cadastrar os valores.

---

## 3. Gaps reais de produto (não é filtro, é catálogo vazio)

### Dresses — zero produto no catálogo inteiro

Categoria `Dresses` já existe (criada em `SQL_DRESSES_CATEGORY_AND_GARMENT_TYPE_EXPANSION.sql`),
mas **nenhum produto foi cadastrado nela** — confirmado com `GET
/products?search=dress` no catálogo inteiro (não só na categoria), zero resultado. O tile
"Dresses" do Shop by Category não tem o que mostrar até entrar produto real.

### Shirts (camisa social) — sem produto distinto de T-Shirt

Todo resultado de `search=shirt` é T-Shirt/Sweatshirt, exceto um caso ambíguo ("Foti Long
Sleeve Shirt White", pode ser camiseta manga longa, não camisa social). Não há produto que
sirva claramente de "camisa" separada de "camiseta" hoje.

---

## Resumo — ação recomendada

| # | Item | Ação | Bloqueia o lançamento da seção? |
|---|---|---|---|
| 1 | T-Shirts, Tops | Nenhuma — linkar direto pra `categoryId=Tops` | Não |
| 2 | Hoodies, Jackets | Curadoria manual (7 produtos, dá pra separar à mão) ou backfill de `garment_type` | Não, com curadoria |
| 3 | Pants, Shorts | Sweatpants já filtra sozinho; resto (20 produtos) por curadoria manual ou backfill | Não, com curadoria |
| 4 | Dresses | Precisa de produto real cadastrado — não tem o que mostrar | **Sim**, até ter produto |
| 5 | Shirts (social) | Precisa de produto real cadastrado (ou remover o tile) | **Sim**, até ter produto |
