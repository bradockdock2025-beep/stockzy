# Verificação de dados reais — "MEN'S COLLECTION" / "WOMEN'S COLLECTION" (template BZ)

> Este documento **não é sobre endpoint** — o mecanismo de filtro (faceta `gender`) já
> existe e está documentado em
> [`ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md`](./ANALISE-ENDPOINTS-HOMEPAGE-TEMPLATE-BZ.md)
> (seção 7). Aqui a pergunta é outra: **temos produto real taggeado por gênero no banco**
> pra alimentar essas duas seções do print? Verificado agora, ao vivo, contra o banco real
> via `GET /catalog/filters` e `GET /products?facets=gender:...` no servidor local
> (`localhost:3000`, mesma `DATABASE_URL` de produção).

---

## Resultado — quase não tem dado

Catálogo inteiro: **274 produtos ativos** (Accessories 62, Apparel 178, Sneakers 34; Shoes,
Electronics, Collectibles e Trading Cards com 0). Desses 274, a faceta `gender` só está
aplicada em **11**:

| Valor | Quantidade | Produtos |
|---|---|---|
| `men` | **0** | — nenhum produto taggeado |
| `women` | 6 | 5 sneakers femininos (Zoom Vomero 5 Photon Dust, Mind 001 Barely Green, Dunk High Panda 2021, Air Force 1 Low Triple White, Gel Kayano 14 Cream Blush — todos "Womens" no nome) + 1 peça de Apparel ("Womens Vintage Horseshoe Longsleeve T Shirt Black") |
| `kids` | 5 | 5 sneakers infantis (tamanho GS/PS — "Grade School"/"Preschool", já é indicador de tamanho infantil no nome) |
| `unisex` | 0 | — nenhum produto taggeado |

**Ou seja: `GET /products?facets=gender:men` devolve zero produtos hoje**, e `gender:women`
devolve só 6 — 5 deles sneakers, não peças de vestuário. Não dá pra montar um grid de 6
produtos de "Men's Collection" nem de "Women's Collection" só com o que já está taggeado.

---

## Por que isso não bloqueia tanto quanto parece

O problema **não é falta de produto no catálogo** — é falta da tag `gender` nos produtos
que já existem. O catálogo tem volume de sobra pra montar os dois grids (178 produtos de
Apparel, a maioria roupa masculina/unissex por natureza do sortimento atual — marcas como
Chrome Hearts, Supreme, Rhude, Enfants Riches Deprimes, Satoshi Nakamoto). O gap é de
**classificação**, não de **estoque**.

Mesmo padrão de gap já visto em
[`VERIFICACAO-DADOS-SHOP-BY-CATEGORY-BZ.md`](./VERIFICACAO-DADOS-SHOP-BY-CATEGORY-BZ.md)
com `garment_type` (taxonomia existe, produto existe, só falta o vínculo entre os dois).

---

## Ação decidida — resolvido no backend, sem fabricar dado

Decisão: isso precisa ser resolvido no back com produto de verdade vinculado a gênero, não
com curadoria manual no front escondendo a falta de dado. Mas "men" não tem **nenhum**
sinal textual no catálogo (busca por "men"/"mens" no nome só retorna os mesmos produtos
"Women's" por substring) — então tagueá-los como `gender:men` seria inventar dado, não
extrair.

**Solução: usar `unisex` pelo que ele realmente é.** Não é chute disfarçado de "men por
padrão" — é a classificação correta pra um catálogo de streetwear (Chrome Hearts, Supreme,
Rhude, Satoshi Nakamoto etc.) sem corte específico de gênero na maioria das peças. A faceta
`gender` já tem esse valor exatamente pra isso.

Dois arquivos SQL geram o backfill completo:

1. [`SQL_GENDER_BACKFILL_WOMEN.sql`](../SQL_GENDER_BACKFILL_WOMEN.sql) — 4 produtos com
   "Women's" explícito no nome que ainda não tinham a tag (sobe `women` de 6 pra 10).
2. [`SQL_GENDER_BACKFILL_UNISEX_DEFAULT.sql`](../SQL_GENDER_BACKFILL_UNISEX_DEFAULT.sql) —
   os 263 produtos ativos restantes, sem nenhuma tag de gênero, viram `unisex`. Rodar
   **depois** do arquivo 1 (senão os 4 "Women's" caem aqui também).

Com isso, os dois filtros passam a devolver produto real:

```
Women's Collection → GET /products?facets=gender:women          (10 produtos)
Men's Collection    → GET /products?facets=gender:men|unisex     (todo o catálogo unisex —
                                                                   o filtro já suporta múltiplos
                                                                   valores por "|"; se um produto
                                                                   exclusivo de homem entrar no
                                                                   futuro, só taguear gender:men
                                                                   nele, a query do front não muda)
```

## Bloqueia o lançamento da seção?

**Não mais**, depois de rodar os dois arquivos acima — os dois filtros passam a devolver
produto real do catálogo, sem depender de curadoria manual escondendo a falta de dado.
