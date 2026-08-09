# Admin — Usuários Internos e Clientes

**Auth:** JWT admin, roles `admin` ou `manager` em tudo.

---

## Usuários internos (equipe/admin) — `/admin/users`

Contas que acessam o painel admin (`role`: `admin` \| `manager` \| `support`).

| Método | Rota | Body/Query |
|---|---|---|
| `POST` | `/admin/users` | `CreateUserDto` |
| `GET` | `/admin/users` | `QueryUserDto`: `role`, `isActive` (string `"true"`/`"false"`), `search`, `page`/`limit` |
| `GET` | `/admin/users/:id` | — |
| `PATCH` | `/admin/users/:id` | `UpdateUserDto` — parcial, inclusive `password` (troca direta, sem confirmar senha atual — cuidado com quem tem acesso a essa tela) |
| `PATCH` | `/admin/users/:id/deactivate` | — |
| `DELETE` | `/admin/users/:id` | Mesmo efeito de deactivate (não é hard delete) |

### `CreateUserDto`

```json
{ "name": "Maria Silva", "email": "maria@stockzy.com", "password": "SenhaForte123", "role": "manager", "isActive": true }
```

---

## Clientes (visão admin) — `/admin/customers`

Somente leitura + edição limitada + desativação (o cadastro do cliente em si é sempre feito pelo próprio cliente via `POST /customers/register`, ver `06-autenticacao-cliente.md`).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/customers` | Lista resumida. `QueryCustomerDto`: `isActive`, `search`, `page`/`limit` ou `cursor` |
| `GET` | `/admin/customers/full` | Lista **com detalhes** (mesmos filtros) — mais pesado, use só se precisar de mais dados que a listagem resumida |
| `GET` | `/admin/customers/export` | Exportação em lote (mesmos filtros de `QueryCustomerDto`) |
| `GET` | `/admin/customers/:id` | Detalhe completo de um cliente |
| `GET` | `/admin/customers/:id/export` | Exportação de um cliente específico (dados completos, tipo LGPD) |
| `PATCH` | `/admin/customers/:id` | `UpdateCustomerAdminDto` |
| `PATCH` | `/admin/customers/:id/deactivate` | — |

### `UpdateCustomerAdminDto`

```json
{ "firstName": "João", "lastName": "Silva", "phoneNumber": "+33...", "isActive": true }
```

Não inclui email/senha — isso o cliente só troca ele mesmo (`07-conta-cliente.md`), o admin não tem esse poder por aqui.
