# Plano — inserção de produtos e upload de imagens a partir de `STORAGES/`

> Gerado em 2026-07-26. **Tratamento dos dados já feito** (seção 1.1) — `scripts/organize-storages.ts` lê `STORAGES/`, descarta lixo, deduplica por hash e classifica cada imagem (marca/nome/categoria/gênero/cor), gerando `STORAGES_MANIFEST.json` (dataset completo) e `STORAGES_MANIFEST_REVIEW.csv` (só os itens com sinal fraco de categoria). **Nada foi inserido no banco nem subido pro storage ainda** — isso continua esperando as decisões de negócio da seção 5/7 (preço, licença de imagem, etc.).

---

## 0. Alerta que preciso levantar antes de tudo

> **✅ RESPONDIDO em 2026-07-26**: "todos estes dados são apenas para desenvolvimento, quando o projeto estiver em produção iremos limpar a base e colocar os produtos reais." Ambiente de dev/staging, descartável antes de produção — segue como planejado abaixo.

As imagens em `STORAGES/` não são fotos próprias — são **capturas de página completa** (padrão "Salvar Como → Página Completa" do navegador: cada pasta `..._files/` tem os mesmos artefatos de página: `.DS_Store`, `download-app-store.svg`, `download-google-play.svg`, um `.css`) tiradas de páginas de catálogo de um marketplace real (o nome dos arquivos segue o padrão `{Produto}-{Colorway}-Product.jpg`, idêntico à convenção de asset da StockX), contendo produtos de marcas reais e protegidas (Nike, Air Jordan, adidas, Supreme, The North Face, BAPE, Sprayground, Palace, Swatch × Omega/Audemars Piguet, seleções nacionais de futebol 2026, etc.).

Isso importa porque:
- **As fotos são provavelmente de terceiros** (StockX e/ou as próprias marcas) — subir isso pro storage da stockzy e apresentar como produto à venda é risco real de direito autoral, não é "dado de exemplo" como os seeds de facet/categoria que já usamos.
- **Marca registrada**: listar "Nike", "Air Jordan", "Supreme" etc. como produtos vendidos por uma loja própria (stockzy) é diferente de um marketplace de revenda tipo StockX — se o modelo de negócio da stockzy for revenda autorizada/consignação, tudo bem; se for "loja própria" vendendo como se fosse dela, aí há um problema de representação, além do de imagem.

**Não vou seguir com upload/inserção real até você confirmar que está ciente disso e que é intencional** (ex.: ambiente de dev/staging pra validar o pipeline; ou vocês têm de fato acordo de revenda; ou é só teste interno, nunca vai pra produção pública com essas imagens). Trato o resto deste documento como plano técnico — a decisão de negócio é sua.

---

## 1. Inventário do que está em `STORAGES/`

13 pastas, 595 arquivos no total:

| Pasta | Contexto (pelo nome da pasta) | Nº arquivos (produto) |
|---|---|---|
| `brands-nike?category=sneakers=product-line=nike-air-max_files` | Marca Nike, linha Air Max | 40 |
| `brands=jordan-category=sneakers&model=1` | Marca Jordan, modelo Air Jordan 1 | 40 |
| `brands=jordan=category=sneakers&model=3_files` | Marca Jordan, modelo Air Jordan 3 | 40 |
| `brands=new-balance=category=sneakers&model=2002r_files` | Marca New Balance, modelo 2002R | 40 |
| `brands=nike?category=sneakers=model=air-force-1_files` | Marca Nike, modelo Air Force 1 | 40 |
| `brands=yeezy?category=sneakers_files` | Marca Yeezy/adidas Yeezy | 40 |
| `brands=asics=category=sneakers&gender=men_files` | Marca ASICS, gênero men | ~39 |
| `brands:swatch_files` | Marca Swatch (relógios) | ~39 |
| `browse=kids_files` | Navegação geral, gênero kids (mistura marcas/categorias) | ~45 |
| `browse=women_files` | Navegação geral, gênero women | ~39 |
| `category=sneakers_files` | Categoria Sneakers, geral | ~40 |
| `category=shoes_files` | Categoria Shoes, geral | ~39 |
| `category=apparel_files` | Categoria Apparel, geral | ~40 |
| `category=accessories=bags=backpacks_files` | Accessories → Bags → Backpacks | ~39 |

### 1.1 Tratamento executado (`scripts/organize-storages.ts`)

Rodei o script (`npx ts-node -T scripts/organize-storages.ts`) — só leitura de `STORAGES/` e escrita dos dois arquivos de manifesto, sem tocar em banco/storage. Resultado real (não estimativa):

| Métrica | Valor |
|---|---|
| Arquivos de imagem processados (566 = 563 `.jpg` + 3 `.png`) | 566 |
| Lixo descartado (`.DS_Store`, `.svg` de app store, `.css`) | 29 |
| **Produtos únicos por conteúdo** (hash sha256, não só nome) | **530** |
| Duplicados (mesma foto, aparece em >1 pasta) | 36 |
| Marca reconhecida | 530/530 (100%, depois de eu adicionar `Onitsuka Tiger`, `Puma`, `UGG`, `Timberland`, `Louis Vuitton`, `Saint Laurent`, `Maison MIHARA YASUHIRO` à lista — descobertas reais na varredura, não inventadas) |
| Por categoria | sneakers 396, accessories 82, shoes 46, apparel 42 |
| Itens sinalizados pra revisão leve | 76 (só "categoria inferida sem sinal de pasta" — todos vêm de `browse=kids_files`/`browse=women_files`, que não têm categoria no nome da pasta; a classificação por palavra-chave ficou, mas marquei como confiança menor) |

**28 marcas distintas identificadas** nos 530 produtos únicos: Jordan (148), Nike (124), New Balance (43), Swatch (40), Yeezy (40), ASICS (38), Sprayground (30), adidas (16), Fear of God Essentials (9), Supreme (8), Onitsuka Tiger (6), Crocs (4), Birkenstock (3), Bravest Studios (3), Timberland (3), BAPE (2), Maison MIHARA YASUHIRO (2), Brain Dead (1), Louis Vuitton (1), Puma (1), Saint Laurent (1), Eric Emanuel (1), Godspeed (1), Gymshark (1), Kith (1), Palace (1), The North Face (1), UGG (1).

Isso substitui/atualiza a lista estimada que eu tinha posto antes na seção 5.4 — a lista real (com contagem) é essa acima.

Arquivos gerados (na raiz do repo, pra você revisar):
- `STORAGES_MANIFEST.json` — os 530 produtos únicos + os 36 duplicados marcados (`isDuplicateOf` aponta pro arquivo original), com `brand`, `nameGuess`, `categorySlug`/`subcategorySlug`, `gender`, `ageGroup`, `colorFacetGuess`, `contentHash`.
- `STORAGES_MANIFEST_REVIEW.csv` — só os 76 itens com categoria de baixa confiança, pra você dar uma olhada rápida em planilha e confirmar/corrigir antes da inserção real.

**Lixo descartado** (artefato de página salva, não é produto): `.DS_Store`, `.svg` de badge de app store, `.css` — excluído automaticamente pelo script, não precisa de confirmação sua.

**Qualidade da imagem — ponto de atenção real**: conferi a resolução de uma amostra e é **140×75px** (thumbnail de grid de catálogo, não foto em alta resolução). Pra uma vitrine "profissional" como você pediu, isso é baixo — serve pra popular o banco e testar o pipeline ponta a ponta, mas eu não recomendaria como imagem final de PDP numa loja em produção. Preciso que você me diga se:
- (a) segue com essas mesmo assim por agora (ideal pra validar o fluxo rápido, troca depois), ou
- (b) você tem (ou vai conseguir) versões em resolução maior antes de eu montar o pipeline de upload definitivo.

---

## 2. O que cada imagem representa, estruturalmente

Cada arquivo = **uma combinação específica de modelo + colorway** (ex.: `Air-Jordan-1-Low-Wolf-Grey-W-Product.jpg` = Air Jordan 1 Low, colorway Wolf Grey, feminino). Isso bate com o próprio modelo StockX: cada colorway é um "produto" com preço próprio; o que varia dentro dele é só o tamanho.

Mapeamento pro nosso schema (`prisma/schema.prisma`), sem mudança nenhuma de schema:
- **1 imagem = 1 `Product`** (nome = modelo + colorway, `categoryId` resolvido pela pasta, `brandId` resolvido pelo prefixo do nome de arquivo)
- **`ProductVariant`** = uma por tamanho da faceta de tamanho aplicável (`size_men`/`size_women`/`size_kids`, já em EU, seed já rodado) — cor fica fixa pro produto inteiro (todo variant do mesmo produto recebe o mesmo `color` facet value, já que a foto não muda por tamanho)
- **`ProductImage`** = a própria imagem, `variantId = null` (imagem do produto, não de uma variante específica — como já funciona hoje no `POST /admin/products/:id/images` sem `variantId`)
- **Facetas**: `gender` (pela pasta/nome), `color` (extraído do nome), `activity`/`shoe_height`/`age_group` só quando dá pra inferir com confiança (ex.: sufixo `-GS`/`-PS` no nome = infantil)

---

## 3. Parsing do nome do arquivo — regras propostas

Padrão observado: `{Marca}[-x-{Marca2}]-{Modelo}-{Colorway}[-{Sufixo}]-Product[_V2|-2|-v2].jpg`

| Sinal no nome | O que indica | Exemplo |
|---|---|---|
| Primeiro(s) token(s) | Marca | `Nike-`, `Air-Jordan-` (Jordan é sub-marca da Nike — trato como marca própria "Jordan", separado de "Nike", que é como o próprio catálogo-fonte organiza — pasta é `brands=jordan`) |
| `-x-` no meio | Colaboração entre 2 marcas | `Kith-x-adidas-Messi-Football-Jersey`, `Travis-Scott-x-Nike-x-FC-Barcelona` |
| Sufixo `-W` ou `-Womens` | Gênero feminino | `Air-Jordan-1-Low-Wolf-Grey-W` |
| Sufixo `-GS` | Infantil "Grade School" → mapeio pra `age_group=child` | `Air-Jordan-11-Retro-Gamma-Blue-2025-GS` |
| Sufixo `-PS` | Infantil "Preschool" → `age_group=preschool` | `Air-Jordan-1-Mid-Violet-Mist-Barely-Grape-PS` |
| Sufixo `-Product`, `_V2`, `-2`, `-v2`, `-3` | Não é parte do nome do produto — variação de crop/ângulo da mesma foto, descarto do nome final | `Nike-Air-Force-1-Low-White-07_V2-Product.jpg` |
| Cor(es) no final antes do sufixo | Colorway → mapeio pro facet `color` quando bate com um dos 12 valores já seedados (black/white/multi/blue/grey/red/yellow/brown/pink/purple/green/orange); quando não bate (ex. "Wolf-Grey", "Bred", "UNC"), guardo como parte do `name` mas **não** força um facet color errado | `Wolf-Grey` → facet `color=grey`; `Bred` (gíria "black+red") → não force, deixo sem facet color até revisão |

**Isso é regra de parsing, não vou inventar dado que o nome não sustenta** — quando o parser não conseguir resolver marca/categoria/gênero com confiança, o item cai numa lista de "revisão manual" em vez de eu chutar.

---

## 4. Mapeamento pasta → categoria/gênero

| Pasta | `categoryId` (slug) | Gênero |
|---|---|---|
| `brands=jordan-*`, `brands-nike*air-max*`, `brands=nike*air-force-1*`, `brands=new-balance*`, `brands=yeezy*`, `brands=asics*men` | `sneakers` (+ subcategoria por linha se der pra inferir, senão fica na raiz `sneakers`) | conforme sufixo do arquivo (`-W`/`-GS`/`-PS`) ou `men` default da pasta ASICS |
| `category=sneakers_files` | `sneakers` | por arquivo |
| `category=shoes_files` | `shoes` (+ subcategoria: slide/clog/etc. por palavra-chave no nome — `Slide`→`slides-sandals`, `Clog`→`clogs`) | por arquivo |
| `category=apparel_files` | `apparel` + subcategoria por palavra-chave (`hoodie`/`sweatshirt`/`jacket`/`windrunner`→`outerwear`; `tee`/`shirt`/`jersey`/`polo`→`tops`; `short`/`pant`/`sweatpant`→`bottoms`; `boxer`/`brief`/`thermal`/`sock`→`undergarments`; resto→`other-apparel`) | por arquivo |
| `category=accessories=bags=backpacks_files` | `accessories` → subcategoria `bags` | n/a (unissex, salvo indicação contrária) |
| `brands:swatch_files` | `accessories` → subcategoria `watches` | n/a |
| `browse=women_files` | por palavra-chave no nome (sneaker/shoe/apparel/acessório) | `women` (fixo pela pasta) |
| `browse=kids_files` | por palavra-chave no nome | `kids` (fixo pela pasta) — sufixos GS/PS refinam `age_group` |

Itens que não derem pra classificar com confiança (ex.: ambíguo entre `apparel`/`accessories`) entram na lista de revisão, não assumo.

---

## 5. Lacunas de dado — o que falta antes de inserir de verdade

### 5.1 Preço — **bloqueador, sem fonte nenhuma**
`ProductVariant.price` é `Decimal` **obrigatório** no schema (`prisma/schema.prisma:` `price Decimal @db.Decimal(12,2)`, sem default). Não existe preço em lugar nenhum de `STORAGES/` (nem no nome do arquivo, nem em outro arquivo de metadado). **Não vou inventar preço.** Preciso que você me diga: tem uma planilha/lista de preço por item? Ou aplicamos um preço-placeholder óbvio (ex. `0.01` ou `999999`) só pra popular o banco em modo "rascunho" (`status=draft`, não visível na loja) até você revisar preço por item?

### 5.2 Estoque — tem default seguro
`Inventory.stockQuantity` default é `0`. Posso inserir tudo com estoque zero (produto existe no catálogo mas não compra até você definir estoque real) — isso não bloqueia, mas confirme que é isso que você quer.

### 5.3 Descrição — sem fonte
`Product.description` é opcional. Não vou gerar descrição de marketing genérica pra cada um dos ~500 itens (seria inventar conteúdo). Proposta: deixar `description = null` no insert automático; você preenche depois pelos itens que quiser destacar, ou me diz se quer um template neutro tipo `"{Marca} {Nome do modelo} — colorway {Colorway}."` (só recombinando o que já está no nome do arquivo, não inventando nada novo).

### 5.4 Marcas ausentes do `SQL_BRANDS_SEED.sql`
O seed atual (20 marcas) só cobre até "Brain Dead" alfabeticamente e foi declarado no próprio arquivo como "referência/exemplo, não é o catálogo definitivo". Já `ASICS`, `adidas`, `BAPE`, `Birkenstock` e `Brain Dead` estão no seed atual — o resto das **28 marcas reais** encontradas na varredura (seção 1.1) precisa entrar num seed novo: Jordan, Nike, New Balance, Swatch, Yeezy, Sprayground, Fear of God Essentials, Supreme, Onitsuka Tiger, Crocs, Bravest Studios, Timberland, Maison MIHARA YASUHIRO, Louis Vuitton, Puma, Saint Laurent, Eric Emanuel, Godspeed, Gymshark, Kith, Palace, The North Face, UGG.

Como isso vem de material real que você me passou (não é invenção), posso gerar um `SQL_BRANDS_SEED_EXTRA.sql` com essas marcas adicionais antes da inserção de produto — mas só depois que você confirmar a lista (nomes exatos que quer usar, já que "Jordan" vs "Air Jordan" como nome de marca é uma escolha sua).

### 5.5 Grade de tamanho por produto
Pra cada sneaker, crio a grade inteira do facet aplicável (14 tamanhos men / 13 women / 18 kids) como `ProductVariant`, todas com estoque 0 até você atualizar? Ou só uma variante "genérica" por produto até você definir quais tamanhos realmente existem em estoque? A primeira opção deixa o catálogo pronto pro filtro de tamanho funcionar; a segunda é mais fiel ao estoque real mas exige que você volte em cada item depois.

### 5.6 Itens de `apparel`/`accessories` sem tamanho (jersey sem grade clara, backpack, relógio)
Roupas/acessórios não têm facet de tamanho seedado ainda (só sneakers têm `size_men/women/kids`). Pra esses, a variante seria única (sem dimensão de tamanho) até existir uma faceta de tamanho de roupa — o que é exatamente o cenário que `familyTag: "vestuario"` em Apparel já deixou preparado, mas a faceta em si (`size_apparel` ou parecido) ainda não existe. Confirma se quer que eu proponha essa faceta agora ou se fica pra depois.

---

## 6. Pipeline técnico proposto (quando formos executar)

1. **Descartar lixo** (`.DS_Store`, `.svg`, `.css`).
2. **Deduplicar por hash de conteúdo** (não só por nome) — os 34 nomes repetidos entre pastas provavelmente são a mesma imagem, mas vou confirmar por hash antes de tratar como certeza, pra não perder uma variação real que só coincide no nome.
3. **Parse de cada nome** → `{marca, nomeModelo, colorway, categoria/subcategoria, gênero, ageGroup?}` seguindo as regras da seção 3-4. Itens ambíguos vão pra uma lista `REVISAO_MANUAL.csv` em vez de eu decidir sozinho.
4. **Resolver `brandId`/`categoryId`** contra o banco (pelas tabelas já seedadas + o seed extra de marca da seção 5.4, se você aprovar).
5. **Upload de imagem** reaproveitando exatamente a lógica que já existe em `products.service.ts` (`uploadProductImages`, bucket via `getStorageSettings()`, path `products/{productId}/product/{uuid}.jpg`) — não vou inventar um pipeline de storage novo, uso o mesmo mecanismo do admin.
6. **Insert de `Product` + `ProductVariant`(s) + `ProductImage` + facets** — via chamada direta ao `ProductsService` (reaproveita toda a lógica de SKU/facet sync que já existe, incluindo `syncProductFacetValues`) rodando como script `ts-node` local, **não** via HTTP pro admin (mais rápido pra ~500 itens, mesma lógica de negócio).
7. **Relatório final**: quantos produtos criados, quantos foram pra revisão manual e por quê, quantas imagens subidas.

Nada disso roda agora — é o desenho de como eu proponho fazer quando você aprovar as decisões da seção 5.

---

## 7. Decisões que preciso de você antes de eu escrever/executar qualquer script

1. **Uso das imagens**: ciente do ponto da seção 0 (imagens não são suas, marcas de terceiros)? Confirma que quer seguir mesmo assim (dev/staging, ou vocês têm autorização)?
2. **Resolução de imagem**: segue com as thumbnails 140×75px por agora, ou espera imagem maior?
3. **Preço**: tem fonte real, ou insiro como rascunho (`status=draft`) com placeholder até você revisar item a item?
4. **Estoque**: tudo com 0 (padrão), confirma?
5. **Descrição**: deixo `null`, ou uso o template neutro recombinando nome/marca/colorway (seção 5.3)?
6. **Marcas novas**: aprova a lista da seção 5.4 (Nike, Jordan, New Balance, Yeezy, Supreme, Fear of God Essentials, Sprayground, Palace, Gymshark, Kith, Swatch, The North Face, Godspeed, Eric Emanuel, Crocs, Bravest Studios), com esses nomes exatos ou algum ajuste?
7. **Grade de tamanho**: cria a grade completa por produto (14/13/18 tamanhos, estoque 0) ou só 1 variante genérica até você informar tamanhos reais (seção 5.5)?
8. **Apparel/Accessories sem faceta de tamanho**: crio já uma faceta `size_apparel` (ou nome que preferir) agora, ou fica pra depois e por enquanto esses produtos entram sem dimensão de tamanho?

Assim que você responder, eu escrevo o script de inserção/upload — ainda como algo que você revisa antes de eu rodar contra o banco real (mesmo cuidado que já vimos aplicando pros seeds SQL).

---

## 8. Decisões confirmadas em 2026-07-26 (dado descartável de dev — seção 0)

1. **Preço**: placeholder `99.99` em todas as 530 variantes-base, `status=active` (fica visível na loja, pra testar o fluxo de compra ponta a ponta com dado fake, já que tudo isso é descartado antes de produção).
2. **Grade de tamanho**: grade completa por produto de calçado (14 tamanhos men / 13 women / 18 kids, conforme o gênero resolvido no manifesto), todas as variantes com `stockQuantity=0`.
3. **Descrição**: template neutro, recombinando só o que já está nos dados tratados — `"{brand} {nameGuess}."` (sem inventar texto novo).
4. **Apparel/Accessories**: criar uma faceta `size_apparel` genérica (XS/S/M/L/XL/XXL), com `visibility=category_family`/`visibilityValue='vestuario'` — só se aplica de fato a Apparel (roupa tem tamanho de letra); os itens de Accessories (backpack/watch/etc., 82 itens) não fazem sentido em S-XXL, então esses continuam com variante única sem dimensão de tamanho, mesmo critério da seção 5.6 original. Registrando esse ajuste de escopo para deixar claro que não força tamanho de roupa em mochila/relógio.

Próximos passos técnicos (nesta ordem): (1) acrescentar `size_apparel` ao `SQL_CATALOG_FACETS_SEED.sql` — idempotente, você re-roda o arquivo; (2) gerar `SQL_BRANDS_SEED_EXTRA.sql` com as 23 marcas novas da seção 5.4; (3) escrever o script de inserção+upload (`scripts/seed-products-from-storages.ts`), validado contra Postgres local antes de eu te entregar — mas que **você roda** contra o banco real (preciso de credenciais Supabase reais e o banco real não é alcançável daqui, mesma limitação de sempre).

---

## 9. Execução e validação (2026-07-26) — pronto pra você rodar

Escrevi e validei `scripts/seed-products-from-storages.ts` contra um Postgres local descartável (schema completo + categorias + facets incluindo `size_apparel` + as 43 marcas):

- **530/530 produtos criados**, 0 erros, 0 pulados.
- **6.196 variantes**, todas com SKU único (`DEV-{hash8}-{tamanho}` — prefixo `DEV-` de propósito, fácil de filtrar/apagar antes de produção).
- Grade de tamanho correta por gênero: 14 (men) / 13 (women) / 18 (kids) para sneakers/shoes, 6 (XS-XXL) para apparel, 1 variante única pra accessories (sem dimensão de tamanho).
- Facetas linkadas: gênero+idade no produto, cor+tamanho na variante.
- **Bug real encontrado e corrigido**: 45 produtos de colaboração (`Swatch-x-Omega...`, `Kith-x-adidas...`, `Palace-x-Nike...` etc.) estavam ficando com **nome vazio** — o parser cortava o nome inteiro achando que era só a marca. Corrigido em `organize-storages.ts`; re-validado, 0 nomes vazios.
- **Risco real pego e travado**: o script carrega o `.env` do projeto (que tem credenciais reais do Supabase) independente do banco de teste — sem querer, a primeira tentativa de rodar localmente ia tentar subir 530 imagens de verdade pro storage de produção. Adicionei a trava `ALLOW_IMAGE_UPLOAD=1` (só sobe imagem se você setar essa env var explicitamente); sem ela, produto/variante/faceta são criados normalmente e o upload fica marcado como `image_upload_skipped` no relatório.

### Como você roda pra valer

1. Confirma que já rodou (na ordem): `SQL_FULL_SCHEMA.sql` → `SQL_CATEGORIES_SEED.sql` → `SQL_CATALOG_FACETS_SEED.sql` (atualizado, com `size_apparel` — se você já rodou a versão anterior, precisa rodar de novo, é idempotente) → `SQL_BRANDS_SEED.sql` → `SQL_BRANDS_SEED_EXTRA.sql`.
2. Roda `npx ts-node -T scripts/organize-storages.ts` (gera/atualiza `STORAGES_MANIFEST.json`, se ainda não tiver rodado).
3. **Teste com amostra representativa primeiro** (recomendado, não os 530 de uma vez): `ALLOW_IMAGE_UPLOAD=1 SEED_SAMPLE_PER_GROUP=2 npx ts-node -T -r tsconfig-paths/register scripts/seed-products-from-storages.ts` — pega pelo menos 2 itens de cada combinação categoria+subcategoria+gênero+idade (hoje: 21 tipos distintos → 36 produtos), cobrindo todo tipo de dado sem precisar dos 530. Validei isso localmente: 36/36 criados, zero erro, cobertura completa das 14 categorias e todos os gêneros/idades. Confirma que a imagem sobe certo (bucket/admin) antes do run completo.
4. Run completo (se quiser todos os 530 depois de validar a amostra): `ALLOW_IMAGE_UPLOAD=1 npx ts-node -T -r tsconfig-paths/register scripts/seed-products-from-storages.ts` (sem `SEED_SAMPLE_PER_GROUP`/`SEED_LIMIT`, sem `ALLOW_IMAGE_UPLOAD` a imagem não sobe).
5. Confere `SEED_PRODUCTS_REPORT.json` no final — lista todo item criado/pulado/com erro/com falha de imagem.

### O que eu NÃO consegui validar (limitação do ambiente, não do código)

- **Upload real pro Supabase Storage** — nunca rodou de fato, só reaproveitei o mesmo caminho que o admin já usa em produção. Testa com `SEED_LIMIT` antes de ir pros 530.
- **`GET /products` / `GET /catalog/filters` contra os dados inseridos** — validei os dados direto no banco (contagens, grades, nomes), não subi a API e bati nos endpoints com esse dataset. Vale um teste manual depois de rodar.
- **Os 76 itens em `STORAGES_MANIFEST_REVIEW.csv`** (categoria de baixa confiança, vindos de `browse=kids`/`browse=women`) — ainda não revisados por você. Não bloqueiam o run (entram numa categoria plausível), mas pode ter uns 5-10 itens mal-classificados nesse grupo.

Como é tudo `DEV-` no SKU e dado descartável (seção 0), limpar antes de produção é `DELETE FROM products WHERE id IN (SELECT product_id FROM product_variants WHERE sku LIKE 'DEV-%')` (cascade cuida do resto) — ou simplesmente `TRUNCATE products CASCADE` se for recomeçar do zero.
