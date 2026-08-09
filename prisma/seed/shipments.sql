-- Shipments + tracking (manual SQL; no Prisma migrations)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM (
      'pending',
      'shipped',
      'in_transit',
      'delivered',
      'failed',
      'returned',
      'cancelled'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status shipment_status NOT NULL DEFAULT 'pending',
  carrier text,
  tracking_number text,
  tracking_url text,
  service_level text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  estimated_delivery_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order
  ON shipments (order_id);

CREATE INDEX IF NOT EXISTS idx_shipments_status
  ON shipments (status);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking
  ON shipments (tracking_number);

CREATE TABLE IF NOT EXISTS shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status shipment_status NOT NULL,
  message text,
  location text,
  occurred_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment
  ON shipment_events (shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_events_status
  ON shipment_events (status);

CREATE INDEX IF NOT EXISTS idx_shipment_events_occurred
  ON shipment_events (occurred_at);
