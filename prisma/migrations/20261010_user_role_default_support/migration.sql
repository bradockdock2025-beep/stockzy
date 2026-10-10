-- PENDENCIAS-BACKEND-GESTAO.md #1.1 — gestor sem enviar `role` criava administrador,
-- porque o default da coluna era `admin`. Não altera utilizadores existentes, só o
-- default aplicado em futuros INSERTs sem `role` explícito.
ALTER TABLE "users"
  ALTER COLUMN "role" SET DEFAULT 'support';
