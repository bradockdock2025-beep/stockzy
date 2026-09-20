# Fix necessário no front — tile "Pants" do Shop by Category

> Ação pontual, não é guia completo (esse já existe em
> [`GUIA-ENDPOINT-HOMEPAGE-SHOP-BY-CATEGORY.md`](./GUIA-ENDPOINT-HOMEPAGE-SHOP-BY-CATEGORY.md),
> que já foi atualizado com esta correção). Este arquivo é só o aviso direto de "o que
> mudar", pra quem for aplicar no front sem precisar reler o guia inteiro.

## O que está errado hoje

Se o front já implementou o tile "Pants" usando a query recomendada antes, está assim:

```
GET /products?facets=garment_type:pants&limit=8
```

Isso retorna só **13 produtos** — e esconde as **119 sweatpants** do catálogo, que também
são calças. Resultado visível pro usuário: ele clica em "Pants" esperando ver todas as
calças da loja e só vê uma fração pequena, mesmo o catálogo tendo 132 no total.

## O que trocar

```
GET /products?facets=garment_type:pants|sweatpants&limit=8
```

Só isso — troca o valor único `pants` por `pants|sweatpants` (o `|` já é suportado pelo
endpoint, é OR entre valores da mesma faceta). Não muda parâmetro, não muda shape de
resposta, não muda nenhum outro tile.

## Antes / depois

| | Query antiga | Query nova |
|---|---|---|
| Request | `facets=garment_type:pants` | `facets=garment_type:pants\|sweatpants` |
| `meta.total` | 13 | 132 |

## Por que

Sweatpants é fisicamente uma calça — a divisão em duas etiquetas internas (`pants` vs
`sweatpants`) existe só por causa de como os dados foram cadastrados em momentos
diferentes, não é uma decisão de produto pra separar visualmente pro cliente. O print da
homepage só tem UM tile "Pants" (não existe tile "Sweatpants" separado), então a query
precisa cobrir as duas etiquetas pra não esconder a maior parte do estoque real.

Nenhum outro tile do Shop by Category muda — só este.
