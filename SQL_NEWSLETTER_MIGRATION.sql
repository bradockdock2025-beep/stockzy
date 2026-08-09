-- =============================================================
-- NEWSLETTER MIGRATION
-- Rodar no Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL UNIQUE,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email  ON newsletter_subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_active ON newsletter_subscriptions (is_active);

-- =============================================================
-- VERIFICAÇÃO
-- SELECT COUNT(*) FROM newsletter_subscriptions;
-- =============================================================
