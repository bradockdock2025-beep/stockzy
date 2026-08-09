# Stockzy API — Visão Geral de Integração

Documentação de referência para integração do frontend com a API do Stockzy. Cada arquivo desta pasta cobre um grupo de endpoints por tema. Toda a informação aqui foi extraída diretamente do código-fonte (controllers, DTOs e schema do banco) — não são exemplos inventados.

## Índice de arquivos

| Arquivo | Conteúdo |
|---|---|
| `01-categorias.md` | Árvore de categorias públicas |
| `02-produtos.md` | Listagem, detalhe, vitrines (ofertas, destaques, lançamentos, mais vendidos) |
| `03-catalogo-filtros-busca.md` | Filtros facetados (`/catalog/filters`), banner de categoria, calendário de lançamentos, busca livre |
| `04-carrinho.md` | Carrinho (guest e cliente autenticado) |
| `05-checkout-guest.md` | Checkout sem conta (guest) |
| `06-autenticacao-cliente.md` | Registro, login, OTP, refresh, logout |
| `07-conta-cliente.md` | Perfil, endereços, consentimentos, senha, email, exportação, exclusão |
| `08-checkout-cliente.md` | Pedido de cliente autenticado + pagamento |
| `09-wishlist.md` | Lista de desejos |
| `10-conteudo-institucional.md` | Homepage (hero/tiles/social), banners, anúncios |
| `11-newsletter-cupons.md` | Newsletter e validação de cupom |
| `12-sistema.md` | Health check, métricas |
| `13-admin-autenticacao.md` | Login do painel admin |
| `14-admin-catalogo.md` | CRUD de categorias, marcas, facetas e produtos (admin) |
| `15-admin-pedidos-pagamentos-envios.md` | Gestão de pedidos, pagamentos, envios e relatórios (admin) |
| `16-admin-conteudo.md` | CRUD de banners, anúncios, homepage e newsletter (admin) |
| `17-admin-usuarios-clientes.md` | Gestão de usuários internos e clientes (admin) |
| `18-admin-outros.md` | Promoções, audit log, rate-limit audits (admin) |
| `19-recomendacoes.md` | Também visto, vistos recentemente, recomendado pra você |
| `20-comportamento-categorias.md` | Como a árvore de categorias se comporta em cada profundidade, e como se une com facetas tipo `garment_type`/`shoe_height` no bloco "Category" da sidebar |

## Base URL

| Ambiente | URL |
|---|---|
| Desenvolvimento local | `http://localhost:3000` |
| Produção | a definir pelo time (ainda não há domínio próprio configurado) |

Todas as rotas abaixo são **relativas a essa base URL** — ex.: `GET /products` = `GET http://localhost:3000/products`.

## CORS

Em desenvolvimento (`NODE_ENV` diferente de `production`), qualquer origem `http://localhost:<qualquer porta>` ou `http://127.0.0.1:<qualquer porta>` é aceita automaticamente. Não precisa configurar nada no backend pra rodar o frontend localmente, independente da porta.

Em produção, só origens explicitamente listadas em `ALLOWED_ORIGINS` (ou `FRONTEND_URL` como fallback) são aceitas.

## Autenticação — visão geral

Existem **dois sistemas de autenticação separados**, não compatíveis entre si:

| Tipo | Usado em | Mecanismo |
|---|---|---|
| **Admin** | rotas `/admin/*` (painel interno) | JWT próprio (`Authorization: Bearer <token>`), emitido por `POST /admin/auth/login` |
| **Cliente** | rotas `/customers/*` (loja, conta do cliente) | Sessão do **Supabase Auth**, emitida por `POST /customers/login`. O `accessToken` retornado é um JWT do Supabase, usado do mesmo jeito: `Authorization: Bearer <accessToken>` |
| **Guest** | `/cart`, `/orders/guest/*` | Sem login — usa um token de carrinho opaco (`x-cart-token`), ver `04-carrinho.md` |
| **API Key** | `/admin/reports/*` | Header `x-admin-key: <ADMIN_API_KEY>` (chave fixa do `.env`, **não é JWT**) |

Rotas marcadas `Público` abaixo não exigem nenhum header de autenticação.

## Formato de erro padrão

A maioria dos erros de negócio (não validação de schema) segue este formato:

```json
{
  "code": "ALGUM_CODIGO_ESTAVEL",
  "message": "Mensagem legível (às vezes em pt, às vezes em en — inconsistente hoje)",
  "statusCode": 400
}
```

Use `code` para lógica no frontend (é estável), não `message` (pode mudar de texto).

Erros de **validação de DTO** (campo obrigatório faltando, tipo errado, etc.) vêm do `ValidationPipe` global e têm este formato, sem `code`:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

`message` aqui é sempre um **array de strings**, uma por campo inválido.

## Paginação

Onde existe paginação (listagens principais), o formato é sempre:

```json
{
  "data": [ /* itens */ ],
  "meta": { "total": 123, "page": 1, "limit": 10, "totalPages": 13 }
}
```

Parâmetros de query: `page` (padrão 1), `limit` (padrão varia por endpoint).

## Preços e moeda

Todos os valores monetários (`price`, `totalAmount`, etc.) são números decimais simples (ex.: `99.99`), **sem símbolo de moeda embutido**. A moeda é `EUR` (`PAYMENT_CURRENCY=EUR` no `.env`) — o frontend precisa formatar/exibir o símbolo.

## Endpoints fora desta documentação (uso interno, não pro frontend)

- `POST /payments/stripe/webhook` — chamado pelo Stripe diretamente, nunca pelo frontend
- `POST /webhooks/supabase/auth` — chamado pelo Supabase diretamente, nunca pelo frontend
- `GET /debug/error` — só teste de integração com Sentry (ver `12-sistema.md`)

## Headers relevantes usados nesta API

| Header | Onde | Para quê |
|---|---|---|
| `Authorization: Bearer <token>` | rotas de cliente/admin autenticadas | JWT |
| `x-cart-token` | `/cart/*`, `/orders/guest/*` | Identifica o carrinho de convidado (ver `04-carrinho.md`) |
| `x-admin-key` | `/admin/reports/*` | Chave fixa de admin (não é JWT) |
| `idempotency-key` / `x-idempotency-key` | alguns endpoints de pagamento | Evita duplicar uma ação em retry |
