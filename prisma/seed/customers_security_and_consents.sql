-- Customers security + consent management (manual SQL; no Prisma migrations)

-- 1) Customers security/consent fields
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_method text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

-- 2) Consents history table
CREATE TABLE IF NOT EXISTS customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type text NOT NULL,
  version text,
  granted boolean DEFAULT true,
  source text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_consents_customer_type_created
  ON customer_consents (customer_id, type, created_at DESC);
