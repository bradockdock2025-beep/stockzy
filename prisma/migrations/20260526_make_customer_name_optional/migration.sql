-- Migration: make_customer_name_optional
-- Date: 2026-05-26
-- Reason: Registration now only requires email + password.
--         First name and last name are collected later (at checkout).

ALTER TABLE "customers" ALTER COLUMN "first_name" DROP NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "last_name" DROP NOT NULL;
