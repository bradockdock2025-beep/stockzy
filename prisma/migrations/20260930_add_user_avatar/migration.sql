-- Foto de perfil dos utilizadores do painel de gestão (pedido em
-- GESTAO-BANZYLO/PEDIDO-BACKEND-FOTO-PERFIL.md) — coluna opcional, sem default.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
