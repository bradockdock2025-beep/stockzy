# Mapeamento — PLP "Electronics" (StockX) → Backend

Análise da página enviada (`stockx.com/category/electronics`) cruzando com o que já existe no backend. Conferido contra o banco real (leitura, sem alterar nada).

---

## 1. Boa notícia: a categoria já existe inteira, sem lacuna nenhuma

Diferente do caso dos jerseys (onde faltava a faceta de tipo de peça), aqui **a estrutura de categoria já bate 100% com o template**. `Electronics` já é raiz, com as mesmas 11 subcategorias do filtro "CATEGORY" da captura:

| Template | Nossa subcategoria | slug |
|---|---|---|
| Computer and Gaming Accessories | Computer and Gaming (Peripherals) | `computer-gaming-peripherals` |
| Computer Components | Computer Components | `computer-components` |
| Other Electronics | Other Electronics | `other-electronics` |
| Audio | Audio | `audio` |
| Video Games | Video Games | `video-games` |
| Gaming Consoles | Gaming Consoles | `gaming-consoles` |
| Laptops & Desktops | Laptops & Desktops | `laptops-desktops` |
| Cellphones | Cellphones | `cellphones` |
| Tablets | Tablets | `tablets` |
| Smartwatches | Smartwatches | `smartwatches` |
| Small Appliances | Small Appliances | `small-appliances` |

Só diferença de nome cosmética (nosso "Computer and Gaming (Peripherals)" vs. o "Computer and Gaming Accessories" do template) — mesma coisa, sem ação necessária a menos que você queira alinhar o texto exato.

Hoje **0 produtos** em qualquer subcategoria de Electronics (confirmei antes de você mandar essa imagem).

---

## 2. Pasta de imagens — 45 arquivos, mas nem todos são eletrônicos

`STORAGES_SAMPLE_UPLOAD/Electronics-StockX_files/` tem 45 imagens. **5 delas não são eletrônicos** — são ruído de outras seções da página salva (mesmo problema do "T-shirt dos Knicks" que apareceu no lote de jerseys, uma imagem que não era bem um jersey):

| Arquivo | Por quê não entra |
|---|---|
| `BAPE-College-Tee-Black-Product.jpg` | Camiseta, categoria Apparel, não Electronics |
| `Nike-Air-Force-1-Low-Supreme-Box-Logo-Black-Product.jpg` | Tênis |
| `Nike-Air-Force-1-Low-White-07-Product_V2.jpg` | Tênis |
| `Sprayground-Lilo-Stitch-Official-Collab-Breakout-Backpack-Multicolor.jpg` | Mochila, categoria Accessories |
| `Product-Placeholder-Default-20210415.jpg` | Placeholder genérico, não é produto real |

As **40 restantes** são eletrônicos de verdade e mapeiam assim:

| Subcategoria | Produtos (contagem) | Exemplos |
|---|---|---|
| `audio` | 4 | Apple AirPods 4, AirPods 4 (Noise Cancelling), AirPods Max, AirPods Pro 3 |
| `computer-components` | 2 | NVIDIA GeForce RTX 5080, RTX 5090 |
| `computer-gaming-peripherals` | 6 | finalmouse Centerpiece Pro (teclado), Steam Controller Gen 2, Sony DualSense (x3 variações), Apple Pencil Pro |
| `gaming-consoles` | ~20 | Nintendo Switch 2 (x2), Xbox Series S/X, PlayStation 5 (várias edições: Digital, Pro, Ultra HD, Disc Spider-Man 2), PlayStation Portal (x2), Valve Steam Machine (x3) |
| `other-electronics` | ~7 | Meta Quest 3 (headset VR), Meta x Ray-Ban Display AI Glasses (3 tamanhos), Meta x Ray-Ban Wayfarer (x2), Teenage Engineering Stem Player |

Câmeras (Canon PowerShot x4, Fujifilm X100VI) não têm subcategoria óbvia dentre as 11 — nem "Audio", nem "Computer", nem claramente "Other Electronics" cobre "câmera" por nome, mas `other-electronics` é o catch-all disponível e funcionaria.

---

## 3. Marcas — aqui sim tem lacuna real

Diferente dos jerseys (onde todas as marcas necessárias já existiam), **nenhuma marca de eletrônico está cadastrada ainda**. Conferi direto no banco: `apple`, `canon`, `fujifilm`, `meta`, `microsoft`, `nvidia`, `nintendo`, `sony`, `valve`, `teenage-engineering`, `finalmouse` — **zero delas existe**. Precisam ser criadas antes de qualquer produto (mesmo mecanismo do `SQL_BRANDS_SEED_EXTRA.sql`, ou via `POST /admin/brands`).

O template também lista dezenas de outras marcas na sidebar (Alienware, AMD, Analogue, ASUS, Audio-Technica, AverMedia, Backbone, Bandai, Bang Olufsen...) — essas não têm imagem/produto nenhum na pasta, então não têm o que cadastrar ainda; ficariam vazias mesmo se criadas agora.

---

## 4. Facetas — nada de novo necessário

`Electronics` não tem `familyTag` definida (confirmei: `null`), então não herda nenhuma faceta com `visibility: category_family` (como `shoe_height`/`calcado` ou `garment_type`/`vestuario` — essas continuam exclusivas de calçado/roupa, corretamente). As facetas genéricas (`color`, `gender`) continuam disponíveis se fizerem sentido — mas **"Gender" no filtro de eletrônicos do template provavelmente é resíduo do sistema de filtro unificado da StockX** (eles usam o mesmo componente de sidebar pra toda categoria), não uma dimensão real de produto eletrônico. Não recomendo replicar esse filtro aqui — não faz sentido de negócio pra fone de ouvido ou câmera.

Nenhuma faceta nova precisa ser criada pra esse lote — `color` já cobre as variações de cor visíveis (Black, White, Silver, Midnight...), embora "Silver"/"Midnight" não estejam na lista de cores já cadastrada (`black, white, multi, blue, grey, red, yellow, brown, pink, purple, green, orange`) — ficariam sem tag de cor ou precisariam de um valor novo (`silver`), dependendo de quanto você quer capturar.

---

## Resumo

| # | Item | Status |
|---|---|---|
| 1 | Estrutura de categoria (Electronics + 11 subcategorias) | ✅ Já existe, sem ação necessária |
| 2 | Marcas (Apple, Canon, Fujifilm, Meta, Microsoft, NVIDIA, Nintendo, Sony, Valve, Teenage Engineering, finalmouse) | ❌ Nenhuma cadastrada — precisa criar antes de qualquer produto |
| 3 | Facetas | ✅ Nenhuma nova necessária (color já serve; "Gender" do template não faz sentido replicar aqui) |
| 4 | Imagens utilizáveis | 40 de 45 (5 são ruído de outras categorias, mesmo padrão do lote de jerseys) |
| 5 | "Silver"/"Midnight" como cor | 🟡 Não existe hoje — decidir se cadastra `silver` como novo valor de `color` ou ignora essa variação |

Mesma dinâmica de antes: sem pedido explícito, não criei nada ainda — nem marca, nem produto, nem SQL.
