-- Schema completo do stockzy-ecommerce-api, gerado do zero (banco vazio → schema.prisma atual)
--
-- Gerado com `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
-- (sem conexão ao banco real). Substitui os fragmentos incrementais anteriores
-- (SQL_CATALOG_FACETS_MIGRATION.sql, SQL_HOMEPAGE_TILE_SECTION_MIGRATION.sql) — como o
-- banco é novo/vazio, não faz sentido aplicar diffs incrementais sobre um estado prévio
-- que não existe; este script cria tudo de uma vez.
--
-- Validado rodando de ponta a ponta contra um Postgres local vazio: 41 tabelas, 12 enums,
-- todas as foreign keys — zero erro.
--
-- 2026-07-28 — ATUALIZADO (Fase 4 do PLANO_CONSISTENCIA_CATALOGO_FACET.md): removidas as
-- 3 tabelas do sistema antigo de atributos (category_attributes, attribute_options,
-- variant_attribute_values), descontinuado em favor do sistema de Facet/FacetValue. Se
-- você já rodou a versão anterior deste arquivo (44 tabelas) no banco real, NÃO precisa
-- rodar este de novo — use SQL_PHASE4_DROP_OLD_TABLES.sql pra só remover as 3 tabelas.
--
-- Ordem de execução (banco novo/vazio):
--   1. Este arquivo (estrutura completa)
--   2. SQL_CATALOG_FACETS_SEED.sql (dados de referência: Brand/Facet/FacetValue)
--
-- Depois de aplicado, formalizar como migration do Prisma (prisma migrate resolve --applied).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('billing', 'shipping');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'paid', 'presale', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'failed', 'awaiting_confirmation', 'paid', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cod', 'stripe');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('pending', 'shipped', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled');

-- CreateEnum
CREATE TYPE "promotion_type" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "promotion_target_type" AS ENUM ('cart', 'product', 'category');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'manager', 'support');

-- CreateEnum
CREATE TYPE "facet_input_type" AS ENUM ('link', 'checkbox', 'swatch', 'slider', 'chip');

-- CreateEnum
CREATE TYPE "facet_scope" AS ENUM ('product', 'variant');

-- CreateEnum
CREATE TYPE "facet_visibility" AS ENUM ('always', 'category_family', 'gender_fixed_absent', 'gender_equals');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" UUID,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "phone_number" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_method" TEXT,
    "terms_accepted_at" TIMESTAMPTZ(6),
    "privacy_accepted_at" TIMESTAMPTZ(6),
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "family_tag" TEXT,
    "banner_title" TEXT,
    "banner_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "product_status" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMPTZ(6),
    "featured_order" INTEGER,
    "display_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rankings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "units_sold_7d" INTEGER NOT NULL DEFAULT 0,
    "units_sold_30d" INTEGER NOT NULL DEFAULT 0,
    "units_sold_all" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "weight_kg" DECIMAL(10,3),
    "height_cm" DECIMAL(10,2),
    "width_cm" DECIMAL(10,2),
    "depth_cm" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "presale_enabled" BOOLEAN NOT NULL DEFAULT false,
    "presale_price" DECIMAL(12,2),
    "presale_limit" INTEGER,
    "expected_available_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "actor_id" UUID,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input_type" "facet_input_type" NOT NULL,
    "scope" "facet_scope" NOT NULL DEFAULT 'product',
    "visibility" "facet_visibility" NOT NULL DEFAULT 'always',
    "visibility_value" TEXT,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facet_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facet_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "extra" JSONB,
    "sort_order" INTEGER,
    "banner_title" TEXT,
    "banner_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facet_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_facet_values" (
    "product_id" UUID NOT NULL,
    "facet_value_id" UUID NOT NULL,

    CONSTRAINT "product_facet_values_pkey" PRIMARY KEY ("product_id","facet_value_id")
);

-- CreateTable
CREATE TABLE "variant_facet_values" (
    "variant_id" UUID NOT NULL,
    "facet_value_id" UUID NOT NULL,

    CONSTRAINT "variant_facet_values_pkey" PRIMARY KEY ("variant_id","facet_value_id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "session_token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "order_number" TEXT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "billing_address" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'pt',
    "guest_phone" TEXT,
    "guest_token" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "confirmation_code_hash" TEXT,
    "confirmation_code_expires_at" TIMESTAMPTZ(6),
    "confirmation_attempts" INTEGER NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL DEFAULT 'pending',
    "carrier" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "service_level" TEXT,
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "estimated_delivery_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "message" TEXT,
    "location" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "type" "address_type" NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "zipcode" TEXT,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_rate_limit_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rate_limit_key" TEXT NOT NULL,
    "ip_address" TEXT,
    "email" TEXT,
    "attempts" INTEGER NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "window_ms" INTEGER NOT NULL,
    "block_ms" INTEGER NOT NULL,
    "penalty_level" INTEGER NOT NULL,
    "penalty_window_ms" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "blocked_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_rate_limit_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "promotion_type" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "min_subtotal" DECIMAL(12,2),
    "max_uses" INTEGER,
    "max_uses_per_customer" INTEGER,
    "label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "target_type" "promotion_target_type" NOT NULL,
    "product_id" UUID,
    "category_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "customer_id" UUID,
    "order_id" UUID,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT NOT NULL,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "mobile_image_url" TEXT,
    "mobile_image_width" INTEGER,
    "mobile_image_height" INTEGER,
    "alt_text" TEXT,
    "href" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "context" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text_pt" TEXT NOT NULL,
    "text_fr" TEXT,
    "text_en" TEXT,
    "text_es" TEXT,
    "link" TEXT,
    "link_text_pt" TEXT,
    "link_text_fr" TEXT,
    "link_text_en" TEXT,
    "link_text_es" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "customer_id" UUID,
    "session_id" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_co_occurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id_a" UUID NOT NULL,
    "product_id_b" UUID NOT NULL,
    "signal" TEXT NOT NULL,
    "score" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "pair_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_co_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wishlist_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_banner" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "desktop_image" TEXT NOT NULL,
    "mobile_image" TEXT,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "cta_label" TEXT NOT NULL,
    "cta_href" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hero_banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_tile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "section" TEXT,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "image_src" TEXT NOT NULL,
    "mobile_image_src" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_tile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_feed_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "handle" TEXT NOT NULL,
    "follow_href" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_feed_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_feed_image" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "src" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "href" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "social_feed_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "subscribed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMPTZ(6),

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_auth_user_id_key" ON "customers"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "idx_customers_phone" ON "customers"("phone_number");

-- CreateIndex
CREATE INDEX "idx_customer_consents_customer_type_created" ON "customer_consents"("customer_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_categories_active" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "idx_categories_parent" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "idx_categories_family_tag" ON "categories"("family_tag");

-- CreateIndex
CREATE UNIQUE INDEX "sku_sequences_scope_key" ON "sku_sequences"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_brand" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "idx_products_featured" ON "products"("featured");

-- CreateIndex
CREATE INDEX "idx_products_status" ON "products"("status");

-- CreateIndex
CREATE INDEX "idx_products_featured_until" ON "products"("featured_until");

-- CreateIndex
CREATE UNIQUE INDEX "product_rankings_product_id_key" ON "product_rankings"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_rankings_score" ON "product_rankings"("score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "idx_variants_active" ON "product_variants"("is_active");

-- CreateIndex
CREATE INDEX "idx_variants_product" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "idx_price_history_variant_created" ON "price_history"("variant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_variant_id_key" ON "inventory"("variant_id");

-- CreateIndex
CREATE INDEX "idx_images_product" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "idx_images_variant" ON "product_images"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "idx_brands_active" ON "brands"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "facets_key_key" ON "facets"("key");

-- CreateIndex
CREATE INDEX "idx_facet_values_facet" ON "facet_values"("facet_id");

-- CreateIndex
CREATE UNIQUE INDEX "facet_values_facet_id_value_key" ON "facet_values"("facet_id", "value");

-- CreateIndex
CREATE INDEX "idx_product_facet_values_value" ON "product_facet_values"("facet_value_id");

-- CreateIndex
CREATE INDEX "idx_variant_facet_values_value" ON "variant_facet_values"("facet_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_session_token_key" ON "carts"("session_token");

-- CreateIndex
CREATE INDEX "idx_carts_customer" ON "carts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_variant_id_key" ON "cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_guest_token_key" ON "orders"("guest_token");

-- CreateIndex
CREATE INDEX "idx_orders_created" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_orders_customer" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_order" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "idx_shipments_order" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "idx_shipments_status" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "idx_shipments_tracking" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "idx_shipment_events_shipment" ON "shipment_events"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_shipment_events_status" ON "shipment_events"("status");

-- CreateIndex
CREATE INDEX "idx_shipment_events_occurred" ON "shipment_events"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_addresses_customer" ON "addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity_id" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_login_rate_limit_audit_email" ON "login_rate_limit_audits"("email");

-- CreateIndex
CREATE INDEX "idx_login_rate_limit_audit_ip" ON "login_rate_limit_audits"("ip_address");

-- CreateIndex
CREATE INDEX "idx_login_rate_limit_audit_created" ON "login_rate_limit_audits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "idx_promotions_active" ON "promotions"("is_active");

-- CreateIndex
CREATE INDEX "idx_promotions_window" ON "promotions"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "idx_promotions_label" ON "promotions"("label");

-- CreateIndex
CREATE INDEX "idx_promotion_targets_promotion" ON "promotion_targets"("promotion_id");

-- CreateIndex
CREATE INDEX "idx_promotion_targets_product" ON "promotion_targets"("product_id");

-- CreateIndex
CREATE INDEX "idx_promotion_targets_category" ON "promotion_targets"("category_id");

-- CreateIndex
CREATE INDEX "idx_promotion_usages_promotion" ON "promotion_usages"("promotion_id");

-- CreateIndex
CREATE INDEX "idx_promotion_usages_customer" ON "promotion_usages"("customer_id");

-- CreateIndex
CREATE INDEX "idx_promotion_usages_used" ON "promotion_usages"("used_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_promotion_usage_order" ON "promotion_usages"("promotion_id", "order_id");

-- CreateIndex
CREATE INDEX "idx_banners_active" ON "banners"("is_active");

-- CreateIndex
CREATE INDEX "idx_banners_position" ON "banners"("position");

-- CreateIndex
CREATE INDEX "idx_announcements_active" ON "announcements"("is_active");

-- CreateIndex
CREATE INDEX "idx_announcements_position" ON "announcements"("position");

-- CreateIndex
CREATE INDEX "idx_product_views_product_id" ON "product_views"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_views_session_id" ON "product_views"("session_id");

-- CreateIndex
CREATE INDEX "idx_product_views_viewed_at" ON "product_views"("viewed_at");

-- CreateIndex
CREATE INDEX "idx_product_views_customer_id" ON "product_views"("customer_id");

-- CreateIndex
CREATE INDEX "idx_co_occ_product_a_score" ON "product_co_occurrences"("product_id_a", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_co_occurrence" ON "product_co_occurrences"("product_id_a", "product_id_b", "signal");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_customer_id_key" ON "wishlists"("customer_id");

-- CreateIndex
CREATE INDEX "idx_wishlist_items_wishlist" ON "wishlist_items"("wishlist_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_product_id_key" ON "wishlist_items"("wishlist_id", "product_id");

-- CreateIndex
CREATE INDEX "idx_homepage_tiles_active_pos" ON "homepage_tile"("is_active", "position");

-- CreateIndex
CREATE INDEX "idx_homepage_tiles_section" ON "homepage_tile"("section", "is_active", "position");

-- CreateIndex
CREATE INDEX "idx_social_feed_images_active_pos" ON "social_feed_image"("is_active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE INDEX "idx_newsletter_subscriptions_email" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE INDEX "idx_newsletter_subscriptions_active" ON "newsletter_subscriptions"("is_active");

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_rankings" ADD CONSTRAINT "product_rankings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facet_values" ADD CONSTRAINT "facet_values_facet_id_fkey" FOREIGN KEY ("facet_id") REFERENCES "facets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_facet_values" ADD CONSTRAINT "product_facet_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_facet_values" ADD CONSTRAINT "product_facet_values_facet_value_id_fkey" FOREIGN KEY ("facet_value_id") REFERENCES "facet_values"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "variant_facet_values" ADD CONSTRAINT "variant_facet_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "variant_facet_values" ADD CONSTRAINT "variant_facet_values_facet_value_id_fkey" FOREIGN KEY ("facet_value_id") REFERENCES "facet_values"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_co_occurrences" ADD CONSTRAINT "product_co_occurrences_product_id_a_fkey" FOREIGN KEY ("product_id_a") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_co_occurrences" ADD CONSTRAINT "product_co_occurrences_product_id_b_fkey" FOREIGN KEY ("product_id_b") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- ============================================================
-- Objetos de banco que não vêm do schema.prisma (prisma migrate diff não captura)
-- ============================================================
-- orders_display_seq: usada por OrdersService.generateOrderNumber pra gerar o número
-- exibido do pedido (STKZ-XXXXXXXX). Sem ela, criação de pedido falha. Ver
-- SQL_CHECK_AND_FIX_ORDERS_SEQUENCE.sql pra checar/corrigir num banco já existente.
CREATE SEQUENCE IF NOT EXISTS orders_display_seq
  START WITH 10000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
