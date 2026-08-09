# Sistema

Endpoints utilitários, não relacionados a negócio. Provavelmente não são consumidos pela UI do storefront, mas documentados por completude.

---

## `GET /`

**Auth:** Público. Retorna uma string simples (não JSON) — endpoint "hello world" de verificação básica de que o servidor está de pé.

## `GET /health`

**Auth:** Público. Health check.

```json
{ "status": "ok", "service": "stockzy-ecommerce-api" }
```

## `GET /metrics`

**Auth:** Público. Métricas no formato Prometheus (texto puro, não JSON) — para observabilidade/monitoramento, não para consumo do frontend.

## `GET /debug/error`

**Auth:** Público, mas **desabilitado em produção** (`NODE_ENV=production` → retorna `{"status": "disabled"}`). Em dev, dispara um erro proposital pra testar a integração com Sentry. Não é um endpoint de negócio — ignorem no frontend.
