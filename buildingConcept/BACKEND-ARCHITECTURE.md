# Arquitetura de Backend — como eu estruturaria

Continuação de [BACKEND-CONCEPT.md](BACKEND-CONCEPT.md) (que definiu os endpoints). Aqui é a estrutura técnica por trás deles: camadas, banco de dados, e onde cada endpoint "mora".

## 1. Camadas

```
Requisição HTTP
   ↓
Controller (rota)      → só recebe/valida input, não tem lógica de negócio
   ↓
Service                → regra de negócio (montar filtro, calcular preço, etc.)
   ↓
Repository              → acesso a dado (banco ou índice de busca)
   ↓
Postgres (fonte da verdade) + Redis (cache, opcional)
```

Nada de lógica de negócio no controller nem query solta no service — cada camada só fala com a de baixo.

## 2. Banco de dados — Postgres (fonte da verdade)

Tabelas principais, direto do que já mapeamos:

- **categories** — id, nome, slug, categoria_pai_id, ordem
- **brands** — id, nome, slug
- **products** — id, nome, descricao, categoria_id, marca_id, patrocinado (bool), criado_em
- **product_variants** — id, product_id, tamanho, cor, preco, estoque
- **facets** — id, nome (Activity, Color...), tipo (checkbox, swatch, slider)
- **facet_values** — id, facet_id, nome, valor_extra (ex.: hex da cor)
- **product_facet_values** — product_id, facet_value_id (tabela de ligação, um produto pode ter várias)
- **favorites** — user_id, product_id
- **users** — id, nome, email, senha_hash

Isso já é suficiente pra rodar tudo com **Postgres puro** no início — sem exagero de infraestrutura.

## 3. O ponto que exige decisão: filtros com contagem dinâmica

O `GET /catalog/filters` precisa responder "quantos produtos existem pra cada marca/cor/atividade, considerando os filtros que o usuário já aplicou". Isso é pesado em SQL puro conforme o catálogo cresce (múltiplos `JOIN` + `GROUP BY` recalculados a cada filtro).

Duas fases, sem over-engineering:

**Fase 1 (MVP, catálogo pequeno/médio):** Postgres direto, com índices nas colunas de filtro (`categoria_id`, `marca_id`, colunas de facet) e queries otimizadas. Funciona bem até uns milhares de produtos.

**Fase 2 (se o catálogo crescer e ficar lento):** introduzir um motor de busca dedicado (Meilisearch/Typesense — mais simples de operar que Elasticsearch) só pra alimentar `GET /products` e `GET /catalog/filters`. O Postgres continua sendo onde o admin cadastra produto; um job/evento replica cada produto pro índice de busca sempre que ele muda. O índice já calcula contagem de facet nativamente (rápido).

Não vale montar essa segunda fase agora — é decisão de quando o catálogo justificar.

## 4. Estrutura de pastas (exemplo)

```
src/
  modules/
    catalog/        → categories, facets/filters
    products/        → products, variants
    brands/
    favorites/
    users/
  infra/
    database/         → conexão Postgres, migrations
    cache/             → Redis (opcional, cache de listagem)
  shared/              → validação, tratamento de erro, paginação genérica
```

Cada módulo tem seu controller, service e repository — os endpoints de [BACKEND-CONCEPT.md](BACKEND-CONCEPT.md) caem cada um dentro do módulo correspondente (ex.: `GET /products` → `modules/products`).

## 5. Exemplo de fluxo real — `GET /products?category=men&color[]=black&sort=price_asc`

1. Controller recebe a query, valida os parâmetros (categoria existe? cor existe?)
2. Service monta os critérios de busca a partir dos parâmetros
3. Repository consulta o Postgres (fase 1) ou o índice de busca (fase 2) com esses critérios
4. Service formata o resultado: lista de produtos + dados de paginação
5. (Opcional) resultado fica em cache por alguns minutos, chave = combinação de filtros

## 6. Cache (Redis) — quando entra

Não é essencial no MVP. Entra quando quisermos aliviar carga em combinações de filtro muito acessadas (ex.: categoria "Men" sem filtro nenhum, que é a mais visitada). Cache curto (1-5 min), invalidado quando algum produto daquela categoria muda.

## 7. Autenticação

Só necessária pros endpoints que dependem de usuário (favoritos, futuramente carrinho/pedido). Token (JWT) simples, sem precisar de sistema de login complexo nessa fase.
