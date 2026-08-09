# Conteúdo Institucional — Homepage, Banners, Anúncios

Todos públicos, sem auth. Conteúdo gerenciável pelo admin (ver `16-admin-conteudo.md`).

---

## `GET /homepage/hero`

Banner principal da home (só um ativo por vez).

### Resposta `200`

```json
{
  "id": "...",
  "desktopImage": "https://...",
  "mobileImage": "https://...",
  "eyebrow": "Nova Coleção",
  "title": "Sneakers Verão 2026",
  "ctaLabel": "Ver tudo",
  "ctaHref": "/sneakers",
  "isActive": true,
  "updatedAt": "..."
}
```

Retorna `null` se nenhum hero ativo estiver configurado — o frontend deve tratar esse caso (não mostrar seção, ou mostrar algo default).

---

## `GET /homepage/tiles`

Tiles/cards de destaque da home (ex.: categorias em destaque, coleções).

### Query params

| Param | Descrição |
|---|---|
| `section` | Opcional — filtra por seção (string livre, definida pelo admin ao criar) |

### Resposta `200`

```json
[
  {
    "id": "...",
    "section": "categorias-destaque",
    "title": "Sneakers",
    "href": "/sneakers",
    "imageSrc": "https://...",
    "mobileImageSrc": null,
    "position": 0,
    "isActive": true,
    "updatedAt": "..."
  }
]
```

Só tiles ativos, ordenados por `position` (crescente), depois `updatedAt` (mais recente primeiro).

---

## `GET /homepage/social`

Feed social (tipo Instagram embutido).

### Resposta `200`

```json
{
  "config": { "id": "...", "handle": "@stockzy", "followHref": "https://instagram.com/stockzy", "updatedAt": "..." },
  "images": [
    { "id": "...", "src": "https://...", "alt": "...", "href": "https://instagram.com/p/...", "position": 0, "isActive": true }
  ]
}
```

`config` pode vir `null` se nunca configurado. `images` só traz as ativas, ordenadas por `position`.

---

## `GET /banners`

Banners promocionais (rotativos, ex.: topo de categoria ou carrossel).

### Resposta `200`

```json
[
  {
    "id": "...",
    "title": "Black Friday",
    "subtitle": "Até 50% off",
    "imageUrl": "https://...",
    "imageWidth": 1920,
    "imageHeight": 600,
    "mobileImageUrl": "https://...",
    "mobileImageWidth": 750,
    "mobileImageHeight": 500,
    "altText": "Banner Black Friday",
    "href": "/ofertas",
    "ctaText": "Ver ofertas",
    "ctaLink": "/ofertas",
    "context": "home",
    "position": 0,
    "isActive": true,
    "startsAt": null,
    "endsAt": null
  }
]
```

**Nota:** existem dois pares de campo de link (`href`/`ctaText`+`ctaLink`) — provavelmente redundância histórica do schema. Use `href` como link principal do banner clicável; `ctaText`/`ctaLink` parecem destinados a um botão separado dentro do banner, mas confirme com o time se a intenção é essa antes de assumir.

`startsAt`/`endsAt` definem uma janela de exibição — **a API já filtra isso** (só retorna banners dentro da janela ativa, se preenchida), o frontend não precisa checar de novo.

---

## `GET /announcements`

Barra de anúncio/aviso no topo do site (multi-idioma).

### Resposta `200`

```json
[
  {
    "id": "...",
    "textPt": "Frete grátis acima de 50€",
    "textFr": "Livraison gratuite dès 50€",
    "textEn": "Free shipping over €50",
    "textEs": "Envío gratis a partir de 50€",
    "link": "/frete",
    "linkTextPt": "Saiba mais",
    "linkTextFr": "En savoir plus",
    "linkTextEn": "Learn more",
    "linkTextEs": "Saber más",
    "isActive": true,
    "startsAt": null,
    "endsAt": null,
    "position": 0
  }
]
```

Só `textPt` é obrigatório no cadastro — os outros idiomas (`textFr`/`textEn`/`textEs`) podem vir `null` se não traduzidos; nesse caso, use `textPt` como fallback no frontend. Mesma coisa vale para `linkText*`.
