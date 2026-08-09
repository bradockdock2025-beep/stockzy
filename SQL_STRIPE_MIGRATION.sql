-- =============================================================
-- STRIPE MIGRATION
-- Rodar no Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================
-- Estado actual do banco:
--   payment_method enum: ["cod"]
--   tabela payments: sem campos novos necessários (metadata já existe)
-- =============================================================

-- 1. Adicionar valor 'stripe' ao enum payment_method
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'stripe';

-- =============================================================
-- VERIFICAÇÃO (rodar após o script acima)
-- Resultado esperado: cod | stripe
-- =============================================================
-- SELECT enumlabel
-- FROM pg_enum
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
-- ORDER BY enumsortorder;
