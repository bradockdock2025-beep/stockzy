-- Migration: orders_display_sequence
-- Date: 2026-06-03
-- Reason: Replace ORD-<uuid> with a short human-readable order number (DJ-XXXXXXXX).
--         A dedicated SEQUENCE starting at 10000 guarantees atomicity and hides real volume.

CREATE SEQUENCE IF NOT EXISTS orders_display_seq
  START WITH 10000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
