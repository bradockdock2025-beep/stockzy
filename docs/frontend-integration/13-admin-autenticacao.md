# Autenticação — Painel Admin

Sistema **separado** da autenticação de cliente (`06-autenticacao-cliente.md`) — JWT próprio desta API, não passa pelo Supabase. Contas de admin são criadas **direto no banco** (não há endpoint de self-registration) com `role`: `admin` \| `manager` \| `support`.

Mesmo padrão de refresh via cookie HttpOnly usado no lado do cliente: cookie `admin_refresh_token`, `httpOnly`, `sameSite: strict`, `secure` em produção. Use `credentials: 'include'` nas chamadas.

---

## `POST /admin/auth/login`

### Body (`LoginDto`)

```json
{ "email": "admin@stockzy.com", "password": "SenhaForte123" }
```

### Resposta `201`

```json
{
  "accessToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": "1d",
  "refreshExpiresIn": "7d",
  "user": { "id": "...", "name": "Admin", "email": "admin@stockzy.com", "role": "admin" }
}
```

`refreshToken` não vem no body (cookie, mesma lógica do lado cliente). Use `accessToken` como `Authorization: Bearer <token>` em todas as rotas `/admin/*` (exceto `/admin/reports/*`, que usa `x-admin-key` — ver `00-visao-geral.md`).

Tem rate limiting específico de login (`LoginRateLimitGuard`) — várias tentativas erradas em pouco tempo bloqueiam temporariamente (erro `429`).

---

## `POST /admin/auth/refresh`

Sem body — lê o refresh token do cookie. Mesma resposta de login (novo `accessToken`, cookie renovado).

## `POST /admin/auth/logout`

Sem body — invalida a sessão e limpa o cookie.

## `GET /admin/auth/me`

Retorna o payload do JWT decodificado (`{ sub, role, email }`), ou `null` se não autenticado.

## `POST /admin/auth/change-password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```
