# Autenticação de Cliente

**Importante:** autenticação de cliente é gerenciada pelo **Supabase Auth** por baixo dos panos (`customers.service.ts` chama `supabaseAuth.getAdminClient()`/`getAnonClient()`), não é um JWT próprio como o admin. Isso tem implicações práticas:

- O `accessToken` que a API devolve é um JWT do Supabase — use-o normalmente como `Authorization: Bearer <accessToken>` nas rotas autenticadas.
- **Confirmação de email é feita pelo Supabase**, não por um link customizado desta API. Não existe ambiente local isolado pra testar isso sem realmente enviar/confirmar via Supabase real.
- O refresh token **não é devolvido no corpo da resposta** — vem só como **cookie HttpOnly** (`customer_refresh_token`). Ver seção "Refresh token e cookies" abaixo.

---

## `POST /customers/register`

**Auth:** Público.

### Body (`RegisterCustomerDto`)

```json
{
  "email": "cliente@example.com",
  "password": "SenhaForte123",
  "phoneNumber": "+33611112222"
}
```

`password` precisa ter ≥8 caracteres, pelo menos 1 maiúscula, 1 minúscula e 1 número.

### Resposta `201`

```json
{ "requiresEmailVerification": true, "email": "cliente@example.com" }
```

Isso **não** loga o usuário automaticamente. Um código OTP/link de verificação é enviado por email (via Supabase). O fluxo de verificação é via `POST /customers/login/otp/verify` ou `.../verify-link` (ver abaixo) — **login normal com senha (`POST /customers/login`) falha com `EMAIL_NOT_VERIFIED` até o email ser confirmado**.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `AUTH_CREATE_FAILED` | Email já registrado e ativo |

---

## `POST /customers/login` — Login com senha

### Body (`LoginCustomerDto`)

```json
{ "email": "cliente@example.com", "password": "SenhaForte123" }
```

### Resposta `201`

```json
{
  "accessToken": "eyJhbGci...",
  "tokenType": "bearer",
  "expiresIn": 3600,
  "customer": {
    "id": "...", "authUserId": "...", "firstName": null, "lastName": null,
    "email": "cliente@example.com", "phoneNumber": "+33611112222",
    "emailVerifiedAt": "2026-07-30T...", "phoneVerifiedAt": null,
    "mfaEnabled": false, "mfaMethod": null,
    "termsAcceptedAt": null, "privacyAcceptedAt": null,
    "marketingConsent": false, "marketingConsentAt": null,
    "isActive": true, "createdAt": "...", "updatedAt": "...",
    "addresses": []
  }
}
```

Note que `refreshToken` **não vem no body** (vem como cookie, ver abaixo). `expiresIn` é em segundos (padrão do Supabase, 3600 = 1h).

### Erros

| Status | `code` | Quando |
|---|---|---|
| `401` | `EMAIL_NOT_VERIFIED` | Conta existe mas o email ainda não foi confirmado |
| `401` | `AUTH_INVALID_CREDENTIALS` | Email/senha errados |
| `401` | `ACCOUNT_DELETED` | Conta foi desativada |

---

## Login sem senha (OTP por email) — alternativa ao login com senha

Fluxo de 2 passos, tipo "magic code":

### `POST /customers/login/otp` — pedir o código

```json
{ "email": "cliente@example.com" }
```
→ `{ "success": true }`. Envia um código de 6 dígitos por email. Tem cooldown (não pode pedir de novo antes de alguns segundos — erro `429` com `code: "OTP_COOLDOWN"` se tentar cedo demais).

### `POST /customers/login/otp/verify` — confirmar o código

```json
{ "email": "cliente@example.com", "token": "123456" }
```
→ mesma resposta de `POST /customers/login` (accessToken + customer + cookie de refresh). Esse fluxo **também serve pra confirmar o email de uma conta recém-criada** — é o passo 2 depois de `POST /customers/register`.

### `POST /customers/login/otp/verify-link` — confirmar via link (não código digitado)

Usado quando o email tem um **link** clicável em vez de um código de 6 dígitos (depende de como o template de email do Supabase está configurado).

```json
{ "tokenHash": "...", "type": "signup" }
```
`type`: `signup` \| `invite` \| `magiclink` \| `recovery` \| `email_change` \| `email` — o valor vem embutido no link do email, o frontend só precisa extrair da URL e repassar.

---

## Refresh token e cookies — leia antes de integrar

O refresh token **nunca aparece em JSON** — é setado automaticamente como cookie `HttpOnly` (`customer_refresh_token`, `sameSite: strict`, `path: /`, validade 7 dias, `secure: true` em produção) em toda resposta de login/registro/refresh bem-sucedida.

**Isso significa que o frontend precisa:**
1. Fazer as chamadas com `credentials: 'include'` (fetch) ou `withCredentials: true` (axios) — senão o navegador não guarda nem envia o cookie.
2. **Não tentar ler ou guardar o refresh token via JS** — é HttpOnly de propósito, não tem como acessar via `document.cookie`.
3. `sameSite: strict` funciona bem entre `localhost:3000` (API) e `localhost:<qualquer porta>` (frontend) — mesmo "site" pro navegador. Se em produção o frontend e a API ficarem em domínios **completamente diferentes** (não subdomínios do mesmo domínio raiz), esse cookie vai parar de ser enviado e o refresh vai quebrar — avisem se for esse o plano de deploy.

### `POST /customers/refresh`

**Não precisa de body nem header** — o backend lê o refresh token direto do cookie. Só chame este endpoint (com `credentials: 'include'`) quando o `accessToken` expirar.

Resposta: mesma estrutura de login (novo `accessToken` + `customer`, cookie de refresh renovado).

### `POST /customers/logout`

Também sem body — invalida a sessão usando o cookie (ou o header `Authorization`, se não houver cookie) e limpa o cookie de refresh.

---

## Reset de senha (esqueci minha senha)

### `POST /customers/password-reset/request`

```json
{ "email": "cliente@example.com", "locale": "pt" }
```
→ sempre responde de forma genérica (não revela se o email existe, por segurança). Envia link de reset por email.

### `POST /customers/password-reset/confirm`

```json
{ "token": "...", "newPassword": "NovaSenhaForte123" }
```
`token` vem do link recebido por email. Mesma regra de senha do registro (≥8 chars, maiúscula+minúscula+número).
