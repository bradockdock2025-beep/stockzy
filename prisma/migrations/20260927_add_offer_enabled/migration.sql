-- Controle de "quais produtos aceitam Make Offer" (antes não existia nenhum — qualquer
-- variante ativa aceitava oferta). Mesmo padrão do presale_enabled: default FALSE,
-- admin liga explicitamente por variante em vez de todo produto nascer ofertável.
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "offer_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
