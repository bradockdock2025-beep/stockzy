# Recomendações — Também Visto, Vistos Recentemente, Recomendado Pra Você

Sistema de recomendação comportamental, baseado em histórico de visualização de produto (`ProductView`) e co-ocorrência de compras. Todos públicos, sem auth.

**Importante:** este sistema depende do frontend **registrar as visualizações** (`POST /products/:id/view`) — sem isso, "vistos recentemente" e "recomendado pra você" ficam sempre vazios (caem no fallback de mais vendidos). Chame esse endpoint sempre que o usuário abrir uma página de produto (PDP).

## Sessão — `sessionId`

Todo o sistema é ancorado num `sessionId` que o **frontend gera e controla** (não é o `x-cart-token`, é outro conceito — um identificador de sessão de navegação, tipicamente um UUID gerado no primeiro acesso e guardado em `localStorage`/cookie). Não existe endpoint que gere esse ID pra você.

---

## `POST /products/:id/view` — Registrar visualização de produto

Chame isso ao carregar a PDP.

### Body (`RecordViewDto`)

```json
{ "sessionId": "uuid-gerado-pelo-frontend", "customerId": "uuid-do-cliente-se-logado", "durationMs": 15000 }
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `sessionId` | Sim | Gerado/guardado pelo frontend |
| `customerId` | Não | Se o usuário estiver logado, passe o `id` do customer (não o `authUserId`) — ajuda a cruzar histórico entre sessões do mesmo cliente |
| `durationMs` | Não | Tempo gasto na página — pode reenviar a mesma chamada ao sair da página pra atualizar isso (dedupe abaixo explica como) |

### Resposta `204` — sem corpo

**Dedup automático:** se a mesma `sessionId` já visualizou esse produto nos últimos 30 minutos, não cria um registro novo — só atualiza `durationMs` do registro existente (se enviado). Pode chamar de novo pra "atualizar o tempo de permanência" sem se preocupar em duplicar.

---

## `GET /products/:id/also-viewed` — "Quem viu este também viu"

Pra seção de produtos relacionados na PDP.

### Query params (`AlsoViewedQueryDto`)

| Param | Descrição |
|---|---|
| `limit` | 1–16, padrão `8` |

### Resposta `200`

```json
{
  "data": [
    {
      "id": "...", "name": "...", "slug": "...",
      "price": 99.99, "compareAtPrice": null, "discountPercent": null,
      "inStock": true,
      "image": { "url": "https://...", "altText": null },
      "category": { "id": "...", "name": "Sneakers", "slug": "sneakers" }
    }
  ],
  "meta": {
    "productId": "...",
    "total": 8,
    "source": "co_occurrence",
    "fallback": false,
    "cacheHit": true
  }
}
```

`meta.source` indica de onde vieram os resultados (não precisa tratar diferente no frontend, é só informativo/debug):
- `co_occurrence` — comportamento real (quem viu X também viu Y)
- `category_bestsellers` — não havia dado comportamental suficiente, completou com mais vendidos da mesma categoria
- `global_bestsellers` — completou com mais vendidos globais

`meta.fallback: true` significa que pelo menos parte do resultado veio das camadas de completude (2 ou 3), não é 100% comportamental — não afeta como exibir, só indica maturidade do dado.

---

## `GET /catalog/recently-viewed` — Vistos Recentemente

**Nota da rota:** fica em `/catalog`, não em `/products`, apesar do tema — decisão técnica pra evitar colisão de rota com `GET /products/:id`.

### Query params (`RecentlyViewedQueryDto`)

| Param | Obrigatório | Descrição |
|---|---|---|
| `sessionId` | Sim | — |
| `customerId` | Não | Se logado, cruza histórico da sessão atual **com** o do cliente (todas as sessões) |
| `limit` | Não | 1–48, padrão do backend (ver serviço, geralmente 12) |

### Resposta `200`

```json
{ "data": [ /* mesmo shape de card do also-viewed */ ] }
```

Produtos distintos (sem repetir), ordenados pela visualização mais recente primeiro.

---

## `GET /catalog/recommended` — "Recomendado Pra Você" (home)

Diferente de `also-viewed`, este **não tem produto-âncora** — é pra seção da home/dashboard, inferindo interesse a partir do histórico geral.

### Query params (`RecommendedQueryDto`)

| Param | Obrigatório | Descrição |
|---|---|---|
| `sessionId` | Não* | — |
| `customerId` | Não* | — |
| `limit` | Não | 1–48 |

*Sem nenhum dos dois, cai direto pro fallback de mais vendidos globais — mande pelo menos `sessionId` sempre que possível.

### Resposta `200`

```json
{ "data": [ /* cards */ ], "meta": { "source": "category_history" } }
```

`meta.source`: `category_history` (achou uma categoria preferida no histórico) \| `global_bestsellers` (sem histórico suficiente, fallback).
