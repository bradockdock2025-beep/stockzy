-- ANALISE-POLITICA-IDENTIDADE-SELLER-2026-10-11.md — registo de consentimento do
-- vendedor (declaração de titularidade/autenticidade), com timestamp. Só é gravado
-- quando o checkbox é confirmado no momento da submissão (a API recusa submeter sem
-- isso) — não existe estado "recusado", a coluna fica NULL só em submissões antigas,
-- anteriores a esta migration.

ALTER TABLE "seller_submissions" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6);
