-- Admin helpers for attribute_options (activate/deactivate)

-- 1) List all options (with category + attribute)
SELECT
  c.name AS categoria,
  c.slug AS categoria_slug,
  a.name AS atributo,
  a.id AS atributo_id,
  o.id AS option_id,
  o.value,
  o.is_active
FROM attribute_options o
JOIN category_attributes a ON a.id = o.attribute_id
JOIN categories c ON c.id = a.category_id
ORDER BY c.name, a.name, o.sort_order NULLS LAST, o.value;

-- 2) List only inactive options
SELECT
  c.name AS categoria,
  c.slug AS categoria_slug,
  a.name AS atributo,
  a.id AS atributo_id,
  o.id AS option_id,
  o.value,
  o.is_active
FROM attribute_options o
JOIN category_attributes a ON a.id = o.attribute_id
JOIN categories c ON c.id = a.category_id
WHERE o.is_active = false
ORDER BY c.name, a.name, o.sort_order NULLS LAST, o.value;

-- 3) Deactivate by option id
-- UPDATE attribute_options
-- SET is_active = false, updated_at = now()
-- WHERE id = '<OPTION_ID>';

-- 4) Activate by option id
-- UPDATE attribute_options
-- SET is_active = true, updated_at = now()
-- WHERE id = '<OPTION_ID>';

-- 5) Deactivate all options for a given attribute name
-- UPDATE attribute_options o
-- SET is_active = false, updated_at = now()
-- FROM category_attributes a
-- WHERE o.attribute_id = a.id
--   AND a.name ILIKE 'Cor';

-- 6) Activate all options for a given attribute name
-- UPDATE attribute_options o
-- SET is_active = true, updated_at = now()
-- FROM category_attributes a
-- WHERE o.attribute_id = a.id
--   AND a.name ILIKE 'Cor';

-- 7) Deactivate options by category + attribute
-- UPDATE attribute_options o
-- SET is_active = false, updated_at = now()
-- FROM category_attributes a
-- JOIN categories c ON c.id = a.category_id
-- WHERE o.attribute_id = a.id
--   AND c.slug = 'moda-calcados'
--   AND a.name ILIKE 'Tamanho%';
