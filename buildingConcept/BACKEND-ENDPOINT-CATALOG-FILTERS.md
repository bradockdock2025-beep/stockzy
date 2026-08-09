# Por que existem DOIS endpoints — `GET /catalog/filters` e `GET /products`

Sua pergunta é a certa: os dois recebem basicamente os mesmos parâmetros de filtro, então por que não é um só? Porque eles respondem **perguntas diferentes**, e misturar os dois numa resposta só deixaria a tela lenta e a lógica confusa.

## As duas perguntas

- **`GET /products`** responde: *"quais produtos batem com o filtro que já está aplicado?"* → alimenta o grid.
- **`GET /catalog/filters`** responde: *"dado o filtro que já está aplicado, quais são as opções que ainda faz sentido eu mostrar na sidebar, e quantos produtos cada uma traria se eu clicar?"* → alimenta os checkboxes/swatches/contadores da sidebar.

Toda vez que o usuário marca ou desmarca um filtro, o frontend chama **os dois de novo**, com os mesmos parâmetros — um atualiza o grid, o outro atualiza a sidebar.

## Exemplo concreto

Usuário já marcou `brand=adidas`. Nesse momento, os dois endpoints são chamados com o mesmo filtro:

```
GET /products?gender=men&brand[]=adidas&page=1
GET /catalog/filters?gender=men&brand[]=adidas
```

`GET /products` devolve a lista de produtos da adidas (o grid muda).

`GET /catalog/filters` devolve, por exemplo:

```json
{
  "activities": [
    { "nome": "Running", "quantidade": 42 },
    { "nome": "Basketball", "quantidade": 18 },
    { "nome": "Soccer", "quantidade": 0 }
  ],
  "colors": [
    { "nome": "Black", "quantidade": 30 },
    { "nome": "White", "quantidade": 25 }
  ],
  "brands": [
    { "nome": "adidas", "quantidade": 60, "selecionado": true },
    { "nome": "Nike", "quantidade": 0 },
    { "nome": "Jordan", "quantidade": 0 }
  ],
  "price_range": { "min": 40, "max": 320 }
}
```

Repara: **depois** de filtrar por adidas, o próprio endpoint de filtros já devolve "Soccer: 0" e "Nike: 0" — é assim que a sidebar consegue, por exemplo, deixar uma opção meio apagada/desabilitada se ela não daria nenhum resultado.

## A regra importante: cada faceta se calcula "ignorando a si mesma"

Se eu já marquei `brand=adidas` e olho pro filtro de **Brand**, ele **não deve considerar o próprio filtro de brand** no cálculo — senão Nike e Jordan sempre apareceriam com quantidade 0 e ninguém conseguiria trocar de marca (o filtro travaria em si mesmo).

Então o cálculo de cada faceta usa **todos os filtros aplicados, exceto o dela própria**:

- Quantidade de cada **Brand** → calculada considerando `gender=men` (e outros filtros ativos), mas **ignorando** o filtro de brand já marcado
- Quantidade de cada **Color** → considerando `gender=men` + `brand=adidas`, ignorando o filtro de color
- Quantidade de cada **Activity** → considerando `gender=men` + `brand=adidas`, ignorando o filtro de activity

Isso é o que permite trocar de marca com um clique, em vez de precisar desmarcar primeiro.

## Passo a passo interno do `GET /catalog/filters`

1. Controller recebe os filtros já aplicados (os mesmos parâmetros de `GET /products`)
2. Para **cada faceta** (Brand, Activity, Color) o service roda uma consulta separada: "conte os produtos por valor dessa faceta, aplicando todos os filtros menos o dela mesma"
3. Para **Price**, calcula min/max real dos produtos que batem com o filtro completo (esse não tem exceção, é sobre o resultado final)
4. Junta tudo numa resposta só e devolve

Ou seja, por dentro `GET /catalog/filters` faz **várias consultas pequenas** (uma por faceta), enquanto `GET /products` faz **uma consulta só** (a lista final). São jobs diferentes — por isso fazem mais sentido como endpoints separados: se fossem um endpoint só, toda vez que só o grid precisasse recarregar (ex.: trocar de página, ordenar) a gente pagaria o custo de recalcular a sidebar inteira à toa.

## Quando cada um é chamado

| Ação do usuário | `GET /products` | `GET /catalog/filters` |
|---|---|---|
| Marca/desmarca um filtro | sim | sim |
| Troca de página (2, 3...) | sim | **não precisa** (sidebar não muda só por trocar página) |
| Muda ordenação (sort) | sim | **não precisa** (ordenação não muda quantidade nem opções) |
| Entra na página pela primeira vez | sim | sim |

Isso reforça por que separar os dois é melhor: economiza chamada desnecessária quando só o grid muda.

## Resumindo: existem duas combinações diferentes, uma dentro da outra

**Combinação 1 — dentro do `GET /products` (o resultado final que aparece no grid):**
- Facetas diferentes se somam com **E**: `gender=men` **E** `brand=adidas` **E** `color=black`
- Valores da mesma faceta se somam com **OU**: `activity=running` **OU** `activity=basketball`

**Combinação 2 — dentro do `GET /catalog/filters` (as opções que aparecem na sidebar):**
- Cada faceta calcula sua contagem aplicando a Combinação 1 inteira, **exceto o próprio filtro dela**
- É por isso que marcar "adidas" não faz "Nike" sumir da lista de Brands (só faz aparecer com quantidade 0 ou menor)

Ou seja: a Combinação 1 decide **o que aparece no grid**. A Combinação 2 usa a mesma lógica da Combinação 1, mas "com um filtro de cada vez retirado", pra decidir **o que aparece disponível na sidebar**. Uma depende da outra, mas não são a mesma conta.

## Facetas condicionais — o caso do "AGE GROUP" em /browse/kids

Até aqui, `GET /catalog/filters` sempre devolvia o mesmo conjunto de facetas (Brands, Activity, Color, Price) independente do filtro aplicado — só a **contagem** de cada opção mudava. Mas na página Kids aparece um filtro a mais, **AGE GROUP** (Child, Preschool, Toddler, Infant, ver [PAGE-BROWSE-MEN.md](PAGE-BROWSE-MEN.md)), que não existe em Men/Women.

Isso muda um pouco o passo 2 do endpoint: antes de calcular a contagem de cada faceta, o backend primeiro precisa decidir **quais facetas existem** pra aquele contexto de filtro — não é uma lista fixa de facetas, é uma lista que depende do `gender` (e, no caso mais amplo, também da `category`, como já vimos com Collectibles/Electronics em [BACKEND-CONCEPT.md](BACKEND-CONCEPT.md)).

Então `GET /catalog/filters?gender=kids` devolveria algo como:

```json
{
  "age_group": [
    { "nome": "Child", "quantidade": 120 },
    { "nome": "Preschool", "quantidade": 80 },
    { "nome": "Toddler", "quantidade": 45 },
    { "nome": "Infant", "quantidade": 30 }
  ],
  "brands": [ ... ],
  "colors": [ ... ],
  "price_range": { "min": 10, "max": 180 }
}
```

E `GET /catalog/filters?gender=men` **não devolveria** a chave `age_group` — nem vazia, simplesmente não existe nessa resposta.

Regra de backend: a relação entre "qual faceta existe pra qual contexto" precisa ser uma configuração guardada (ex.: `facet_visible_when: gender=kids`), não algo fixo no código — senão toda vez que aparecer um filtro novo condicional desses vai exigir alterar o endpoint na mão.

## Formalizando a regra: tabela de visibilidade de faceta

Agora que já vimos mais páginas ([ROUTES-AND-FILTERS.md](ROUTES-AND-FILTERS.md): `/browse/men`, `/browse/kids`, `/category/sneakers`), dá pra transformar aquela tabela comparativa em uma **configuração real** que o backend consulta, em vez de um `if` escrito à mão pra cada página nova que aparecer.

Conceito de tabela `facet_rules` (cada faceta tem uma condição de quando aparece):

| facet | condição de exibição (`visible_when`) |
|---|---|
| Category | sempre — mas o **conteúdo** depende do `category_id` atual (mostra os filhos dele) |
| Gender | só quando `gender` **não** veio fixo na requisição |
| Brands, Activity, Color, Price | sempre |
| Shoe Height | só quando a categoria efetiva (fixada ou navegada) tem a tag `familia = calcado` |
| ~~Men's / Women's / Kid's Size~~ | ~~mesma condição de Shoe Height~~ → **corrigido abaixo**, não é regra fixa por família |
| Age Group | só quando `gender = kids` (fixo na requisição ou escolhido como filtro) |

**Isso é dado, não código** — fica guardado junto com o cadastro de cada faceta (a mesma tabela `Facet` que já existe desde [BACKEND-CONCEPT.md](BACKEND-CONCEPT.md)), com um campo tipo `visible_when` descrevendo a condição.

Confirmado com dado real em [PAGE-CATEGORY-SHOES.md](PAGE-CATEGORY-SHOES.md): `/category/sneakers` e `/category/shoes` têm a **sidebar idêntica** (mesmas facetas condicionais ativas), só muda o conteúdo de Category. Isso mostra que a condição não deve checar `category = sneakers` categoria por categoria — o certo é o cadastro de `Category` ter uma tag (`familia: calcado`) e a regra checar a tag, não o id da categoria. Assim uma categoria nova de calçado herda o filtro certo automaticamente, sem editar a regra. **Isso continua valendo pra Shoe Height.**

## Correção: Men's/Women's/Kid's Size não é regra por família — é cálculo dinâmico

Em [PAGE-CATEGORY-ACCESSORIES.md](PAGE-CATEGORY-ACCESSORIES.md) apareceu `MEN'S SIZE` na sidebar de `/category/accessories` — categoria que **não é calçado** (relógio, óculos, mochila, gorro). Isso derruba a regra `visible_when: familia = calcado` pra esse filtro especificamente.

A explicação mais simples: **Men's/Women's/Kid's Size não é uma faceta com regra fixa de visibilidade — é uma faceta que só aparece se, no contexto de filtro atual, existir pelo menos 1 produto com variante de tamanho daquele tipo cadastrada.** Ou seja, entra no mesmo mecanismo de cálculo dinâmico que já usamos pra Brands/Activity/Color (contar por valor, com o resto dos filtros aplicados) — só que aqui a contagem decide não só "quantos produtos por tamanho", mas também **se a faceta inteira aparece ou não** (se a soma de todos os tamanhos daquele tipo for zero, a faceta some da resposta).

Isso é diferente de Shoe Height e Age Group, que continuam sendo regra fixa (`visible_when` baseado em tag de categoria / valor de gender) — porque essas são características que só existem conceitualmente pra determinado tipo de produto, enquanto tamanho (M/W/Kid) é algo que qualquer produto pode ou não ter cadastrado, independente da categoria.

## Como o `GET /catalog/filters` usa essa tabela em cada chamada

Passo extra, antes do passo 2 já descrito (calcular contagem por faceta):

1. Recebe o contexto da requisição: o que veio fixo pela rota (`gender` fixo? `category` fixo? qual?) + os filtros que o usuário já marcou
2. Percorre a tabela `facet_rules` e, pra cada faceta, avalia a condição contra esse contexto → monta a lista de facetas que **essa resposta específica** vai ter
3. Só then calcula a contagem (passo 2 antigo) pra cada faceta que passou no filtro de visibilidade

Aplicando nos três casos que já documentamos:

- `GET /catalog/filters?gender=men` (rota `/browse/men`) → Gender fixo → **exclui** faceta Gender; category não fixa e sem família calçado definida → **exclui** Shoe Height/Size; gender ≠ kids → **exclui** Age Group. Sobra: Category, Brands, Activity, Color, Price.
- `GET /catalog/filters?gender=kids` (rota `/browse/kids`) → mesma coisa, mas gender = kids → **inclui** Age Group também.
- `GET /catalog/filters?category=sneakers` (rota `/category/sneakers`) → category fixa e é da família calçado → **inclui** Shoe Height e os 3 blocos de Size; gender não veio fixo → **inclui** Gender também.

Com essa tabela, adicionar uma faceta condicional nova no futuro é **inserir uma linha de configuração**, não mexer no código do endpoint.
