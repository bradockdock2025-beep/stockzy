-- Attribute options setup (fixed options for filters)

CREATE TABLE IF NOT EXISTS attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, value)
);

CREATE INDEX IF NOT EXISTS idx_attribute_options_attribute
  ON attribute_options(attribute_id);

ALTER TABLE attribute_options
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Fixed size options for any attribute named like "Tamanho%"
INSERT INTO attribute_options (attribute_id, value, sort_order)
SELECT a.id, v.value, v.sort_order
FROM category_attributes a
CROSS JOIN (VALUES
  ('36', 36),
  ('37', 37),
  ('38', 38),
  ('39', 39),
  ('40', 40),
  ('41', 41),
  ('42', 42),
  ('43', 43),
  ('44', 44)
) AS v(value, sort_order)
WHERE a.name ILIKE 'Tamanho%'
AND NOT EXISTS (
  SELECT 1 FROM attribute_options o
  WHERE o.attribute_id = a.id AND o.value = v.value
);

-- Fixed gender options
INSERT INTO attribute_options (attribute_id, value, sort_order)
SELECT a.id, v.value, v.sort_order
FROM category_attributes a
CROSS JOIN (VALUES
  ('Masculino', 1),
  ('Feminino', 2),
  ('Unissex', 3),
  ('Infantil', 4)
) AS v(value, sort_order)
WHERE a.name ILIKE 'Genero'
AND NOT EXISTS (
  SELECT 1 FROM attribute_options o
  WHERE o.attribute_id = a.id AND o.value = v.value
);

-- Fixed color options
INSERT INTO attribute_options (attribute_id, value, sort_order)
SELECT a.id, v.value, v.sort_order
FROM category_attributes a
CROSS JOIN (VALUES
  ('Preto', 1),
  ('Branco', 2),
  ('Cinza', 3),
  ('Azul', 4),
  ('Vermelho', 5),
  ('Verde', 6),
  ('Amarelo', 7),
  ('Rosa', 8),
  ('Roxo', 9),
  ('Marrom', 10),
  ('Bege', 11),
  ('Laranja', 12),
  ('Dourado', 13),
  ('Prata', 14),
  ('Multicolor', 99)
) AS v(value, sort_order)
WHERE a.name ILIKE 'Cor'
AND NOT EXISTS (
  SELECT 1 FROM attribute_options o
  WHERE o.attribute_id = a.id AND o.value = v.value
);

-- Fixed voltage options
INSERT INTO attribute_options (attribute_id, value, sort_order)
SELECT a.id, v.value, v.sort_order
FROM category_attributes a
CROSS JOIN (VALUES
  ('110V', 1),
  ('220V', 2),
  ('Bivolt', 3)
) AS v(value, sort_order)
WHERE a.name ILIKE 'Voltagem%'
AND NOT EXISTS (
  SELECT 1 FROM attribute_options o
  WHERE o.attribute_id = a.id AND o.value = v.value
);

-- Fixed infant/kids size options (restricted to child categories)
INSERT INTO attribute_options (attribute_id, value, sort_order)
SELECT a.id, v.value, v.sort_order
FROM category_attributes a
JOIN categories c ON c.id = a.category_id
CROSS JOIN (VALUES
  ('RN', 1),
  ('0-3M', 2),
  ('3-6M', 3),
  ('6-9M', 4),
  ('9-12M', 5),
  ('12-18M', 6),
  ('18-24M', 7),
  ('2', 8),
  ('4', 9),
  ('6', 10),
  ('8', 11),
  ('10', 12),
  ('12', 13),
  ('14', 14)
) AS v(value, sort_order)
WHERE a.name ILIKE 'Tamanho%'
  AND c.slug IN ('bebe-roupas', 'moda-infantil')
AND NOT EXISTS (
  SELECT 1 FROM attribute_options o
  WHERE o.attribute_id = a.id AND o.value = v.value
);
