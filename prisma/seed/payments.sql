-- Payments (manual SQL; no Prisma migrations)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'pending',
      'awaiting_confirmation',
      'paid',
      'failed',
      'cancelled',
      'expired'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'awaiting_confirmation'
        AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'awaiting_confirmation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'paid'
        AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'paid';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'cancelled'
        AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'cancelled';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'expired'
        AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'expired';
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cod');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  confirmation_code_hash text,
  confirmation_code_expires_at timestamptz,
  confirmation_attempts int NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  confirmed_by uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (status);

CREATE INDEX IF NOT EXISTS idx_payments_order
  ON payments (order_id);
