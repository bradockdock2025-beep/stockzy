# Conta do Cliente

**Auth:** Todos os endpoints deste arquivo exigem `Authorization: Bearer <accessToken>` (obtido em `06-autenticacao-cliente.md`).

---

## `GET /customers/me`

Retorna o perfil completo do cliente logado.

### Resposta `200`

```json
{
  "id": "...", "authUserId": "...", "firstName": null, "lastName": null,
  "email": "cliente@example.com", "phoneNumber": "+33611112222",
  "emailVerifiedAt": "2026-07-30T...", "phoneVerifiedAt": null,
  "mfaEnabled": false, "mfaMethod": null,
  "termsAcceptedAt": null, "privacyAcceptedAt": null,
  "marketingConsent": false, "marketingConsentAt": null,
  "isActive": true, "createdAt": "...", "updatedAt": "...",
  "addresses": [ { "id": "...", "type": "shipping", "street": "...", "city": "...", "state": null, "zipcode": "...", "country": "FR" } ]
}
```

## `PATCH /customers/me` e `PATCH /customers/profile`

**São o mesmo endpoint duplicado** (mesmo handler, duas rotas) — use qualquer um dos dois, tanto faz.

### Body (`UpdateCustomerDto`, todos opcionais)

```json
{ "firstName": "João", "lastName": "Silva", "phoneNumber": "+33611112222" }
```

Resposta: o customer atualizado (mesmo shape de `GET /customers/me`, sem `addresses`).

---

## Verificação de email

### `POST /customers/verify/email`

Body opcional: `{ "redirectTo": "https://..." }` (URL de retorno após clicar no link do email).

- Se o email **já está verificado no Supabase** mas ainda não sincronizado localmente: `{ "verified": true, "emailVerifiedAt": "..." }` (sincroniza e retorna já verificado).
- Senão, reenvia o email de confirmação: `{ "success": true }`.

## Verificação de telefone

### `POST /customers/verify/phone`

Body opcional: `{ "channel": "sms" }` (ou `"whatsapp"`). Envia um código por SMS/WhatsApp. Erro `400` se não houver telefone cadastrado.

### `POST /customers/verify/phone/confirm`

```json
{ "token": "123456" }
```
Confirma o código recebido.

---

## `PATCH /customers/mfa`

```json
{ "enabled": true, "method": "totp" }
```
`method`: `sms` \| `email` \| `totp`, **obrigatório se `enabled: true`**. Resposta: `{ "mfaEnabled": true, "mfaMethod": "totp" }`.

---

## `PATCH /customers/password`

```json
{ "currentPassword": "SenhaAtual123", "newPassword": "SenhaNova456" }
```

**Pré-requisito:** o email precisa estar verificado — senão retorna `400 EMAIL_VERIFICATION_REQUIRED` com um hint de ação (`{"action": "RESEND_EMAIL_VERIFICATION", "endpoint": "/customers/verify/email"}`) pro frontend saber o que oferecer ao usuário.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `EMAIL_VERIFICATION_REQUIRED` | Email ainda não confirmado |
| `401` | `PASSWORD_INVALID` | `currentPassword` errada |

---

## `PATCH /customers/email`

```json
{ "email": "novo-email@example.com", "redirectTo": "https://..." }
```

Resposta: `{ "success": true, "email": "novo-email@example.com", "verificationRequired": true }` — o email só troca de fato depois que o link de confirmação (enviado pro **novo** endereço) for clicado.

### Erros

| Status | `code` | Quando |
|---|---|---|
| `400` | `EMAIL_IN_USE` | Email já usado por outra conta |

---

## Consentimentos (LGPD/GDPR)

### `GET /customers/consents`

Lista o histórico de consentimentos registrados (termos, privacidade, marketing).

### `POST /customers/consents`

```json
{ "type": "marketing", "granted": true, "version": "v1", "source": "checkout" }
```
`type`: `terms` \| `privacy` \| `marketing`. Cada chamada cria um novo registro de auditoria (histórico completo é mantido, não sobrescreve).

---

## `GET /customers/export`

Exportação completa dos dados do cliente (dados pessoais + endereços + pedidos com itens) — para atender pedido de portabilidade de dados (LGPD/GDPR). Resposta é o objeto `Customer` completo com relações aninhadas.

---

## Endereços

### `GET /customers/addresses`

Lista todos os endereços do cliente logado.

```json
[
  { "id": "...", "customerId": "...", "type": "shipping", "street": "10 Rue de Test", "city": "Paris", "state": null, "zipcode": "75001", "country": "FR", "createdAt": "...", "updatedAt": "..." }
]
```

### `POST /customers/addresses`

```json
{ "type": "shipping", "street": "10 Rue de Test", "city": "Paris", "state": null, "zipcode": "75001", "country": "FR" }
```
`type`: `billing` \| `shipping`. `state`/`zipcode` opcionais, resto obrigatório. Resposta `201` com o endereço criado.

### `PATCH /customers/addresses/:id`

Mesmos campos, todos opcionais. `404`/`400` se o endereço não existe ou não pertence ao cliente logado.

### `DELETE /customers/addresses/:id`

Remove o endereço. Resposta `200` com o objeto removido.

---

## `DELETE /customers/me` — Excluir conta

**Não é hard delete** — marca `isActive: false` e desloga a sessão globalmente (todos os dispositivos). Resposta: `{ "success": true }`.
