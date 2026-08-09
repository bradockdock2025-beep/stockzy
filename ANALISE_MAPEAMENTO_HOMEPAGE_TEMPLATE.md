# Mapeamento — Template de Homepage (estilo StockX) → Endpoints do Backend

Análise seção-por-seção do template de homepage enviado, cruzando com os endpoints já documentados em `docs/frontend-integration/`. Cada linha indica: endpoint exato a usar, parâmetros necessários, e se há alguma lacuna (endpoint que não existe ainda no backend).

Legenda: ✅ mapeamento direto — 🟡 mapeamento aproximado (funciona, mas não é 100% o conceito do template) — ❌ não existe endpoint pra isso hoje.

---

## 1. Header

| Elemento do template | Endpoint | Observação |
|---|---|---|
| Barra de busca | `GET /search`, `GET /search/suggestions` | `03-catalogo-filtros-busca.md`. Suggestions pro autocomplete, search pra página de resultado |
| Nav "Sneakers", "Shoes", "Apparel", "Collectibles", "Trading Cards" | ✅ `GET /categories` | `01-categorias.md` — assumindo que essas são categorias raiz cadastradas. **Confirmar se os nomes/slugs batem** com o que está no banco hoje |
| Nav "Trending" | 🟡 `GET /products/best-sellers` | Não é uma categoria, é um atalho pra vitrine de mais vendidos |
| Nav "New" | 🟡 `GET /products/new-arrivals` | Idem, atalho pra vitrine |
| Nav "Deals" | 🟡 `GET /products/best-prices` ou `/products/offers` | Dois conceitos diferentes no backend (desconto de preço vs. promoção cadastrada) — decidir qual o menu "Deals" deve abrir |
| Nav "Men" / "Women" / "Kids" | 🟡 `GET /products?facets=gender:men` (ou `women`/`kids`) | Não são categorias, são valores da faceta `gender` — usar o mecanismo de facetas (`03-catalogo-filtros-busca.md`), não `categoryId` |
| Nav "More" | — | Provavelmente um menu dropdown de UI agregando os itens acima, sem chamada própria |
| "Sign Up" / "Login" | ✅ `POST /customers/register`, `POST /customers/login` | `06-autenticacao-cliente.md` |

---

## 2. Hero banner ("THE RETURN OF A CLASSIC — AJ13 Flint")

| Endpoint | Arquivo |
|---|---|
| ✅ `GET /homepage/hero` | `10-conteudo-institucional.md` |

---

## 3. "Recommended For You"

| Endpoint | Arquivo | Parâmetros |
|---|---|---|
| ✅ `GET /catalog/recommended` | `19-recomendacoes.md` | `sessionId` (gerado pelo frontend), `customerId` se logado |

**Pré-requisito:** só funciona bem se o frontend já estiver chamando `POST /products/:id/view` nas páginas de produto — sem histórico de navegação, essa seção sempre cai no fallback de mais vendidos globais.

---

## 4. "Popular Brands" (carrossel de logos: Jordan, YZY, POP MART, Supreme, Pokémon)

| Endpoint | Status |
|---|---|
| ❌ Não existe | **Lacuna real** |

Hoje só existe `GET /admin/brands` (autenticado, admin) — não há endpoint **público** de listagem de marcas. Pra essa seção (e a #20, "Browse More Brands", que é a mesma necessidade) funcionar, é preciso um novo endpoint, por exemplo `GET /brands` público, devolvendo `{id, name, slug, logoUrl}[]` das marcas ativas. Não dá pra montar isso hoje só combinando o que já existe — `GET /catalog/filters` até lista marcas, mas só as que têm produto no filtro atual, com contagem, não é a mesma coisa que "todas as marcas pra vitrine".

---

## 5. "Trending Sneakers"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/best-sellers` | `categoryId=<id-da-categoria-sneakers>` |

`02-produtos.md`. Devolve produto completo (com `variants`/`images`), não o card enxuto.

---

## 6. "Featured Apparel"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/highlights` | `categoryId=<id-da-categoria-apparel>` |

Usa `featured: true` internamente — precisa que o admin tenha marcado produtos de vestuário como destaque (`featured`/`featuredUntil` em `PATCH /admin/products/:id`, ver `14-admin-catalogo.md`).

---

## 7. "Xpress Shipping Available"

| Endpoint | Status |
|---|---|
| ❌ Não existe conceito de "envio expresso" no backend | **Lacuna real** |

Não há campo de variante/produto indicando velocidade de envio. A aproximação mais próxima seria `GET /products?inStock=true` (só o que tem estoque físico, presumindo que presale/encomenda é o que demora), mas isso não é a mesma coisa que "elegível pra envio expresso" — seria preciso decidir a regra de negócio e possivelmente um novo campo/facet antes de implementar essa seção de verdade.

---

## 8. Banners duplos ("A NEW WAY TO DISCOVER HEAT" / "GEAR UP FOR CLASS — Affirm")

| Endpoint | Arquivo |
|---|---|
| ✅ `GET /banners` | `10-conteudo-institucional.md` |

Cada banner do template = um item do array (`context` pode ser usado pra diferenciar "onde na página" cada banner deve aparecer, ex.: `context: "home_mid"`).

---

## 9. "StockX Staff Picks" (5 tiles: Top Picks Under $100, Sports Edit, Backpacks, Kids Shop, School Essentials)

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /homepage/tiles` | `section=staff-picks` (ou o nome de seção que o admin cadastrar) |

`10-conteudo-institucional.md`. Cada tile já tem `title`+`imageSrc`+`href` prontos — o `href` de cada tile deve apontar pra uma URL de listagem já filtrada (ex.: `/products?maxPrice=100`), montada e cadastrada manualmente pelo admin, não calculada dinamicamente pelo backend.

---

## 10. "Most Popular Around You"

| Endpoint | Status |
|---|---|
| 🟡 Sem geolocalização real | **Lacuna parcial** |

O backend não tem conceito de localização do usuário (nem endereço de IP geolocalizado, nem preferência de região salva). Pra essa seção funcionar como está no template (baseada em proximidade geográfica), falta esse recurso. Aproximação possível sem mudar nada: usar `GET /products/best-sellers` de novo (mesmo que #5) ou `GET /catalog/recommended` — mas nenhum dos dois é "ao seu redor" de verdade.

---

## 11. "Featured Accessories"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/highlights` | `categoryId=<id-da-categoria-accessories>` |

Mesmo mecanismo da #6, categoria diferente.

---

## 12. "Seasonal Favorites" (tiles: T-Shirts, Slides, Hoodies, Hats, Sunglasses)

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /homepage/tiles` | `section=seasonal-favorites` |

Mesmo padrão da #9.

---

## 13. "New to StockX"

| Endpoint |
|---|
| ✅ `GET /products/new-arrivals` |

`02-produtos.md`, sem `categoryId` (mostra novidades de todas as categorias).

---

## 14. Release Calendar (cards com data — Jul 31, Jul 31...)

| Endpoint |
|---|
| ✅ `GET /catalog/release-calendar` |

`03-catalogo-filtros-busca.md` — mapeamento exato, já devolve `expectedAvailableAt` pronto pra exibir a data no card.

---

## 15. "As Seen On Instagram"

| Endpoint |
|---|
| ✅ `GET /homepage/social` |

`10-conteudo-institucional.md` — mapeamento exato.

---

## 16. "Most Popular Shoes"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/best-sellers` | `categoryId=<id-da-categoria-shoes>` |

Mesmo padrão da #5, categoria "Shoes" em vez de "Sneakers" — **confirmar que essas são categorias distintas de verdade no cadastro**, e não a mesma coisa com nomes diferentes no template.

---

## 17. Banners duplos ("START 'EM FRESH FROM DAY ONE" / combo produto+colecionável)

| Endpoint |
|---|
| ✅ `GET /banners` |

Mesmo mecanismo da #8.

---

## 18. "Picks For Her"

| Endpoint | Status |
|---|---|
| 🟡 Aproximação | Sem conceito de "curadoria editorial" |

Duas formas de fazer, nenhuma é uma curadoria de verdade feita a dedo com facilidade:
- `GET /products?facets=gender:women&featured=true` — depende de marcar produtos femininos como `featured` manualmente
- `GET /homepage/tiles?section=picks-for-her` apontando pra uma URL de listagem pré-filtrada, cadastrada pelo admin (mesmo padrão da #9/#12)

A segunda opção é mais alinhada ao que o template sugere (uma seleção editorial, não um filtro genérico).

---

## 19. "Trending Trading Cards"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/best-sellers` | `categoryId=<id-da-categoria-trading-cards>` |

Mesmo padrão da #5/#16.

---

## 20. "Browse More Brands"

Mesma lacuna da seção #4 — ❌ precisa do endpoint público de marcas que ainda não existe.

---

## 21. Banners duplos ("PACK LIKE A PRO" / "PUT YOUR BEST FOOT FORWARD")

| Endpoint |
|---|
| ✅ `GET /banners` |

---

## 22. "Collectibles Staff Picks"

| Endpoint | Parâmetros |
|---|---|
| ✅ `GET /products/highlights` | `categoryId=<id-da-categoria-collectibles>` |

Mesmo padrão da #6/#11.

---

## 23. "From The Magazine" (artigos/blog)

| Endpoint | Status |
|---|---|
| ❌ Não existe | **Lacuna real** |

Não há nenhum módulo de CMS/blog/artigo neste backend. Se essa seção for pro escopo real do projeto, é uma funcionalidade nova a ser desenhada do zero (model novo, admin CRUD, endpoint público) — não é algo que dá pra improvisar com o que já existe.

---

## 24. "Criar conta" (banner de cadastro)

| Endpoint | Arquivo |
|---|---|
| ✅ `POST /customers/register` | `06-autenticacao-cliente.md` |

Se a intenção real for captar email pra newsletter (não conta completa), o endpoint certo é outro: `POST /newsletter/subscribe` (`11-newsletter-cupons.md`). **Confirmar qual dos dois é a intenção** antes de implementar — o botão único "Criar conta" sugere cadastro completo, mas o texto ao lado ("app/frete/pagamento") lembra mais uma chamada de newsletter/app.

---

## 25. Footer

| Elemento | Endpoint |
|---|---|
| Links de categoria (Adidas, Apparel, New Balance, etc.) | ✅ `GET /categories` — mesma árvore da nav do header |
| Seletor de idioma/moeda | ❌ Não existe endpoint — moeda é fixa (`EUR`, ver `00-visao-geral.md`), idioma (`locale`) é controlado pelo frontend/URL, não por uma preferência salva no backend |
| Selos de confiança, app store, redes sociais | — | Conteúdo estático, sem endpoint |

---

## Resumo — o que falta no backend pra este template funcionar 100%

| # | Lacuna | Usado em |
|---|---|---|
| 1 | Endpoint público de listagem de marcas (`GET /brands`) | "Popular Brands" (#4), "Browse More Brands" (#20) |
| 2 | Conceito de "envio expresso" (campo/facet) | "Xpress Shipping Available" (#7) |
| 3 | Geolocalização de usuário | "Most Popular Around You" (#10) |
| 4 | Módulo de blog/magazine | "From The Magazine" (#23) |

O resto do template (21 das 25 seções) já tem endpoint correspondente, pronto pra integrar.
