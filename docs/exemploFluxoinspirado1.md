# este è exempo de fluxo tirado no site https://www.one54africa.com/

Aqui está o fluxo de checkout (guest checkout) reconstruído a partir das 6 imagens, em ordem:

## 1. Carrinho (Cart)
- Usuário adiciona o produto **One54 Graphic Sweatshirt** (Size S · $68) ao carrinho.
- Ícone do carrinho no topo mostra contador "1".
- Modal **"Cart (1)"** exibe: imagem do produto, nome, tamanho, preço, subtotal ($68) e aviso "Made to order · All sales final".
- Botão principal: **"Checkout (1 item)"**.

## 2. Seleção de país/localização
- Ao clicar em "Checkout", abre modal **"Where are you shopping from?"**
- Campos:
  - Select de país (com bandeira + nome) — ex: 🇦🇴 Angola
  - Campo "Postal / Zip code" (preenchido automaticamente com um código padrão de 4 dígitos ao escolher o país, ex: "1000")
- Botão: **Continue**

## 3. Resumo do pedido + moeda (idioma muda para PT)
- Modal de checkout abre com seletor de moeda no topo: **"Escolha uma moeda"**
  - Opções: 🇦🇴 AOA 82.263,98 / 🇺🇸 US$ 86,20
  - Taxa de conversão exibida: "1 USD = 954,3385 AOA"
- Resumo do produto (nome, tamanho, descrição, preço convertido)
- Subtotal, botão "Adicionar código promocional"
- Entrega: Standard (prazo estimado) + valor
- Total devido
- Botão "Ocultar/Mostrar" para expandir/colapsar o resumo
- Opções de pagamento rápido: **Apple Pay** e **Link**
- Divisor "OU"
- Início do formulário "Dados de envio" (E-mail, Endereço de entrega...)

## 4. Formulário de envio (parte 1)
- Continuação do mesmo modal, com scroll:
  - E-mail
  - Endereço de entrega: Nome completo, País (Angola, select), Endereço linha 1, Endereço linha 2, Cidade, Telefone (com bandeira/código do país)
- Início da seção **"Forma de pagamento"** → Cartão (número, validade MM/AA, CVC)
- Checkbox: "Os dados de faturamento são iguais aos de envio" (marcado)
- Checkbox: "Salvar minhas informações para checkout mais rápido" (Link/Weave)

## 5. Formulário de envio (parte 2) + pagamento
- Mesma tela, scroll completo mostrando todo o formulário de uma vez
- Botão final azul: **"Pagar"**
- Rodapé: "Powered by Stripe" + links Termos/Privacidade

## 6. Resumo expandido (revisão antes de pagar)
- Mesmo modal anterior de moeda/resumo, mas com o campo de "código promocional" já expandido/em foco (campo de input visível e em destaque)
- Mostra novamente: Subtotal, Entrega, Total devido, botões Apple Pay/Link, e início do formulário de envio

---

### Fluxo resumido (passo a passo)
1. **Produto → Cart (1)** → clica "Checkout"
2. **Modal país** → seleciona país → zip/postal auto-preenchido → "Continue"
3. **Modal pagamento (Stripe)** abre:
   - Seletor de moeda (local vs USD)
   - Resumo do pedido (produto, subtotal, frete, total)
   - Opção rápida: Apple Pay / Link
   - Ou formulário manual: e-mail → endereço de entrega → telefone → forma de pagamento (cartão)
4. Usuário pode inserir **código promocional** (expande campo)
5. Confirma dados de faturamento = dados de envio
6. Opcional: salvar dados para checkout futuro (via Link)
7. Clica em **"Pagar"** → processado via Stripe

Quer que eu monte isso como um diagrama de fluxo (flowchart) visual, ou prefere que eu documente como especificação técnica (user flow + wireframe) em um arquivo?