# Como funciona o endpoint principal da página Men — `GET /products`

Detalhamento de como o backend processa, passo a passo, a chamada que alimenta o grid de produtos da página `/browse/men`. Continua [BACKEND-CONCEPT.md](BACKEND-CONCEPT.md) e [BACKEND-ARCHITECTURE.md](BACKEND-ARCHITECTURE.md).

## Quando a página carrega, o frontend dispara (em paralelo):

1. `GET /gender/men` → banner + breadcrumb (`Gender / Men`)
2. `GET /catalog/filters?gender=men` → opções da sidebar
3. `GET /products?gender=men&sort=featured&page=1&per_page=52` → o grid

O grid é o mais importante porque é o que muda toda vez que o usuário mexe em algum filtro. Vou detalhar esse.

## Exemplo real de chamada (usuário já filtrou algo)

```
GET /products?gender=men&brand[]=adidas&activity[]=running&color[]=black&price_min=0&price_max=200&sort=featured&page=1&per_page=52
```

## O que acontece dentro do backend, passo a passo

**1. Controller recebe a requisição**
Só extrai os query params da URL. Não decide nada ainda.

**2. Validação**
- `gender=men` existe na lista de valores de gênero (Men, Women, Kids, Unisex)? Se não existir → responde erro 404.
- `brand[]=adidas` existe no cadastro de marcas? Se vier uma marca inválida, o backend ignora esse valor (não quebra a busca) ou devolve erro 400, dependendo da regra que a gente definir.
- `activity[]=running` existe na lista fixa de atividades (Running, Basketball, Skateboarding, Soccer, Hiking, Golf, Football)? Mesma regra: valor fora da lista é ignorado, não quebra a busca.
- `price_min <= price_max`? Se não, erro 400.
- `page >= 1`? Se vier página maior que o total existente, devolve lista vazia (não erro).

**3. Service monta um filtro interno normalizado**
Transforma os parâmetros da URL (texto) em algo que faz sentido pro banco entender — por exemplo, troca `brand[]=adidas` pelo `id` real da marca "adidas" no banco, não pelo nome.

**4. Repository monta e executa a consulta no banco**
Em português, a consulta seria: "traga os produtos cujo gênero é Men, cuja marca é adidas, cuja atividade é running, cuja cor é preto, e cujo preço esteja entre 0 e 200 — ordenados por destaque, mostrando 52, começando do produto 1".

Junto, o backend faz uma segunda contagem: "quantos produtos no total batem com esse filtro" (sem paginação) — é esse número que vira `total_produtos` e `total_paginas` na resposta.

**5. Para cada produto encontrado, resolve o preço a mostrar**
Se o produto tem várias variantes (tamanhos), o backend pega o **menor preço entre as variantes com estoque disponível** — é esse valor que aparece no card. Se o produto tem só uma variante, mostra o preço dela direto.

**6. Service formata a resposta final**
Monta um objeto enxuto só com o que o card precisa mostrar (não manda a ficha técnica inteira do produto, só o resumo).

**7. Controller devolve a resposta**

```json
{
  "products": [
    {
      "id": 4521,
      "nome": "adidas Campus 00s Grey Carbon",
      "imagem": "https://.../campus-00s.jpg",
      "marca": "adidas",
      "preco_a_partir_de": 77,
      "patrocinado": false
    },
    {
      "id": 4522,
      "nome": "Jordan 1 Retro Low OG SP Travis Scott",
      "imagem": "https://.../jordan1.jpg",
      "marca": "Jordan",
      "preco_a_partir_de": 302,
      "patrocinado": false
    }
  ],
  "paginacao": {
    "pagina_atual": 1,
    "total_paginas": 3,
    "total_produtos": 148
  }
}
```

## Sobre o filtro Activity (checkbox marcado, ver [PAGE-BROWSE-MEN.md](PAGE-BROWSE-MEN.md))

Quando o usuário marca "Running" na sidebar, o frontend adiciona `activity[]=running` na URL da chamada. Como é **multi-seleção** (checkbox, não link único como Category), se o usuário marcar "Basketball" também, a URL fica:

```
GET /products?gender=men&activity[]=running&activity[]=basketball&sort=featured&page=1
```

No passo 4 (consulta ao banco), isso vira uma condição de "OU" entre os valores marcados: traga produtos que tenham a atividade running **OU** basketball (dentro do produto continuar batendo com os outros filtros, que são "E" entre si). Ou seja:

- Entre valores **da mesma faceta** (Running, Basketball dentro de Activity) → `OU`
- Entre **facetas diferentes** (Activity `E` Brand `E` Color `E` Price) → `E`

É essa combinação de regra que faz o filtro se comportar do jeito esperado: marcar duas atividades amplia o resultado, mas cruzar com marca/cor estreita o resultado.

Desmarcar o checkbox simplesmente remove aquele `activity[]=running` da URL na próxima chamada — não existe um estado "negativo" guardado, o filtro é sempre reconstruído do zero a partir do que está marcado na tela no momento.

## Sobre ordenação (`sort`)

O parâmetro `sort` muda só uma parte da consulta no passo 4 (a ordem do resultado):
- `featured` → ordena por um campo de "peso/destaque" que a gente define no cadastro do produto
- `price_asc` / `price_desc` → ordena pelo preço resolvido no passo 5
- `newest` → ordena pela data de cadastro do produto

## Sobre erro e casos vazios

- Filtro sem nenhum produto correspondente → não é erro, devolve `"products": []` com `total_produtos: 0`.
- Página maior que o total existente → mesma coisa, lista vazia.
- Parâmetro de filtro que não existe no cadastro (ex.: cor inventada) → melhor ignorar silenciosamente do que quebrar a busca inteira.

## Essa mesma estrutura serve pra /browse/women (e /browse/kids)?

Sim, sem criar nada novo. É o **mesmo endpoint, mesmo formato de resposta** — só muda o valor de um parâmetro na chamada.

Vale reforçar um ponto que já tinha aparecido em [CONCEPT.md](CONCEPT.md): "Men/Women/Kids" tecnicamente não é uma categoria de produto (não é irmã de Sneakers/Apparel/Shoes) — é um **valor da faceta Gender**, que qualquer categoria de moda pode ter. O breadcrumb do próprio StockX confirma isso: `Gender / Men`, não `Category / Men`.

Então, na prática, o backend trata assim:

```
GET /products?gender=men&sort=featured&page=1&per_page=52     → página Men
GET /products?gender=women&sort=featured&page=1&per_page=52   → página Women
GET /products?gender=kids&sort=featured&page=1&per_page=52    → página Kids
```

E dá pra combinar `gender` com `category` ao mesmo tempo, porque são filtros independentes:

```
GET /products?gender=women&category=sneakers&color[]=black
```

`GET /catalog/filters` funciona igual: recebe `gender=women` e devolve as opções de Brand/Activity/Color/Price já recalculadas só com produtos femininos. O banner e o breadcrumb (`GET /categories/{slug}` no doc anterior) também seguem o mesmo padrão, só que puxando pelo valor de gênero em vez de categoria — dá pra generalizar para `GET /gender/{slug}` ou simplesmente tratar "men/women/kids" como mais uma entrada da tabela de facet_values.

Resumindo: **zero endpoint novo por gênero**. Criar a página Women é 100% front-end (nova rota que chama os mesmos endpoints com `gender=women`) — o backend não muda.

## Por que a consulta ao banco funciona bem mesmo com vários filtros juntos

Contanto que as colunas usadas nos filtros (categoria, marca, cor, preço) tenham índice no banco, o Postgres consegue combinar todos eles numa única consulta rápida — é assim que dá pra aplicar Category + Brand + Color + Price ao mesmo tempo sem ficar lento, no cenário do MVP (fase 1 descrita em [BACKEND-ARCHITECTURE.md](BACKEND-ARCHITECTURE.md)).
