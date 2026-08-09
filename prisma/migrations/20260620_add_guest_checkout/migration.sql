-- AlterTable: make customer_id nullable (guest orders)
ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;

-- AlterTable: add guest checkout fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_token" TEXT;

-- CreateIndex: unique constraint on guest_token
CREATE UNIQUE INDEX IF NOT EXISTS "orders_guest_token_key" ON "orders"("guest_token");
