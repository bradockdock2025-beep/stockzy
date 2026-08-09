# Análise — Múltiplas imagens (ângulos) por produto

Pergunta: um item de produto pode ter vários ângulos de foto (frente, lado, verso, sola...). O backend já suporta isso? Análise abaixo — nada foi implementado.

**Correção importante:** a primeira versão deste documento recomendava agrupar imagens por cor (`colorFacetValueId`), assumindo que um produto pudesse ter várias cores entre suas variantes (variante = cor+tamanho). Você apontou o erro: o agrupamento certo é o **modelo do produto**, não a variante. Verifiquei contra o banco real (leitura) pra confirmar antes de reescrever — ver §2.

---

## 1. O que já existe hoje

`ProductImage` ([schema.prisma:208-223](prisma/schema.prisma#L208)):

```prisma
model ProductImage {
  id        String          @id
  productId String
  variantId String?         // opcional — null = imagem genérica do produto
  url       String
  altText   String?
  position  Int             @default(0)
}
```

Uma imagem pode pertencer só ao produto (`variantId = null`, compartilhada por todas as variantes) ou a uma variante específica. `POST /admin/products/:id/images` já aceita múltiplos arquivos de uma vez, com `variantId` opcional ([products.service.ts:1590-1695](src/modules/products/products.service.ts#L1590)).

## 2. Verificação contra o banco real — minha suposição anterior estava errada

Rodei duas queries de leitura na produção:

```sql
-- Quantos produtos têm mais de 1 cor distinta entre suas variantes?
→ 0

-- Das imagens já cadastradas, quantas são por variante vs. genéricas do produto?
→ imagens_por_variante = 0, imagens_genericas_produto = 213
```

**Confirmado: neste catálogo, cor nunca varia dentro do mesmo produto.** Cada colorway (ex.: "Palace x Nike England... Pewter Grey Bright Crimson") já é o seu próprio `Product`, com variantes existindo só pra tamanho. A faceta `color` tem escopo técnico `variant` no schema, mas na prática operacional adotada nesta sessão, cor = produto, 1:1, sempre.

Isso muda a resposta inteira: o problema que eu descrevi antes (upload duplicado por tamanho) **já está resolvido hoje**, sem nenhuma mudança de código — porque as 213 imagens reais já são todas genéricas do produto (`variantId = null`), automaticamente compartilhadas por todos os tamanhos daquele produto.

## 3. Onde estava meu erro

Eu parti da faceta `color` ter `scope: 'variant'` no schema e assumi que, na prática, um produto poderia ter múltiplas cores como variantes diferentes (tipo "Preto 42", "Branco 42" no mesmo Product) — daí a ideia de agrupar imagem por cor em vez de por variante exata. Não verifiquei contra o dado real antes de escrever a recomendação. O dado real mostra que essa situação não acontece neste catálogo: cor já particiona em produtos separados. Group por "modelo do produto" (ou seja, o `Product` em si) é exatamente o nível certo — e já é o que o sistema faz quando você sobe a imagem sem passar `variantId`.

## 4. Recomendação corrigida

**Não precisa de nenhuma mudança de schema.** A estrutura certa já existe:

- **Pra múltiplos ângulos de um modelo/colorway**: subir as fotos no nível do produto (upload sem `variantId`) — já funciona, já é o padrão usado nos 213 registros reais, compartilha automaticamente entre todos os tamanhos daquele produto.
- **`variantId` continua disponível** só pro caso raro de uma variante específica ter uma foto exclusiva que nenhuma outra do mesmo produto tem (ex.: uma etiqueta ou selo que só aparece numa edição de tamanho específico) — não é o caminho principal, é uma exceção.
- **Ordem de exibição**: `position` já resolve — primeira foto enviada = capa. Convenção a documentar (não a construir): sempre subir a foto de frente primeiro.
- **`toListItem`** (capa do card do grid, [products.service.ts:179-190](src/modules/products/products.service.ts#L179)) já pega a primeira imagem do produto por `position` — como hoje praticamente 100% das imagens são genéricas do produto (não há mistura real com imagens de variante), esse comportamento já é correto na prática, ao contrário do que eu tinha escrito antes.

**Não recomendo** (mesma razão de antes, ainda válida): campo de "ângulo" (enum front/back/side/sole) — nenhuma feature real depende de saber qual imagem é qual ângulo especificamente; `position` já basta.

## 5. Conclusão

O backend já está preparado pra múltiplos ângulos por produto, do jeito que este catálogo realmente opera (cor = produto). Não é preciso implementar nada — é só continuar usando o upload sem `variantId` quando for fotografar um modelo/colorway inteiro, como já vem sendo feito.
