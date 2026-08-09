# Admin — Conteúdo (Homepage, Banners, Anúncios, Newsletter)

**Auth:** JWT admin, roles `admin` ou `manager` em tudo deste arquivo.

---

## Homepage — `/admin/homepage`

### Hero

| Método | Rota | Body |
|---|---|---|
| `PUT` | `/admin/homepage/hero` | `UpdateHeroDto` — cria se não existir, atualiza se já existe (upsert; é sempre um único hero) |
| `POST` | `/admin/homepage/hero/upload` | `multipart/form-data`, campos `desktopImage`/`mobileImage` (até 1 cada, 5MB, imagem) — envia pro Supabase Storage e já salva a URL no hero |

`UpdateHeroDto`: `{ desktopImage, mobileImage, eyebrow, title, ctaLabel, ctaHref, isActive }` — todos opcionais, string (URL) pras imagens se você já tem a URL (em vez de fazer upload pelo endpoint acima).

### Tiles

| Método | Rota | Body |
|---|---|---|
| `GET` | `/admin/homepage/tiles` | `?section=` opcional — **mostra inativos também**, diferente do `GET /homepage/tiles` público |
| `POST` | `/admin/homepage/tiles` | `CreateTileDto`: `{ section?, title, href, imageSrc, mobileImageSrc?, position?, isActive? }` |
| `PATCH` | `/admin/homepage/tiles/:id` | Parcial |
| `DELETE` | `/admin/homepage/tiles/:id` | — |

### Social

| Método | Rota | Body |
|---|---|---|
| `PATCH` | `/admin/homepage/social/config` | `{ handle?, followHref? }` — upsert, config única |
| `POST` | `/admin/homepage/social/images` | `{ imageSrc, alt, href?, position?, isActive? }` |
| `PATCH` | `/admin/homepage/social/images/:id` | Parcial |
| `DELETE` | `/admin/homepage/social/images/:id` | — |

---

## Banners — `/admin/banners`

| Método | Rota | Body |
|---|---|---|
| `POST` | `/admin/banners` | `CreateBannerDto` (ver `10-conteudo-institucional.md` pros campos) |
| `POST` | `/admin/banners/:id/image` | `multipart/form-data`, campo `file` (1 arquivo, 5MB, imagem) — upload direto, alternativa a passar `imageUrl` já pronta no create |
| `GET` | `/admin/banners` | `QueryBannerDto` (filtros — checar se precisar de algo além do básico) |
| `GET` | `/admin/banners/:id` | — |
| `PATCH` | `/admin/banners/:id` | Parcial |
| `PATCH` | `/admin/banners/:id/deactivate` | — |
| `DELETE` | `/admin/banners/:id` | — |

---

## Anúncios — `/admin/announcements`

| Método | Rota | Body |
|---|---|---|
| `POST` | `/admin/announcements` | `CreateAnnouncementDto` (ver `10-conteudo-institucional.md`) |
| `GET` | `/admin/announcements` | `QueryAnnouncementDto` |
| `GET` | `/admin/announcements/:id` | — |
| `PATCH` | `/admin/announcements/:id` | Parcial |
| `PATCH` | `/admin/announcements/:id/deactivate` | — |
| `DELETE` | `/admin/announcements/:id` | — |

---

## Newsletter (admin, só leitura + remoção) — `/admin/newsletter`

| Método | Rota | Query |
|---|---|---|
| `GET` | `/admin/newsletter/subscriptions` | `page`, `limit`, `activeOnly` (`"false"` pra incluir cancelados, padrão só ativos) |
| `GET` | `/admin/newsletter/subscriptions/export` | `activeOnly` — exportação completa (sem paginação) |
| `DELETE` | `/admin/newsletter/subscriptions/:id` | — remove o registro (diferente de unsubscribe, que só desativa) |

Não há criação manual de inscrito pelo admin — isso só acontece via `POST /newsletter/subscribe` (público).
