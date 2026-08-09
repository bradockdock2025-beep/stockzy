-- Única marca nova pro lote Sell-Apparel-category-tshirt — todas as outras (adidas,
-- Anti Social Social Club, Billionaire Boys Club, Eric Emanuel, Fear of God Essentials,
-- Godspeed, Gymshark, Kith, Nike, Palace, Supreme) já existem.
--
-- Idempotente (ON CONFLICT DO NOTHING). Pré-requisito: SQL_FULL_SCHEMA.sql aplicado.

INSERT INTO brands (id, name, slug, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Hellstar', 'hellstar', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug = 'hellstar');
