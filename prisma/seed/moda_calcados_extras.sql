-- Extra categories for Moda > Calcados
-- Safe to re-run: inserts are guarded by NOT EXISTS

-- Botas
INSERT INTO categories (name, slug, parent_id)
SELECT 'Botas', 'botas', p.id
FROM categories p
WHERE p.slug = 'moda-calcados'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'botas');

-- Sandalias
INSERT INTO categories (name, slug, parent_id)
SELECT 'Sandalias', 'sandalias', p.id
FROM categories p
WHERE p.slug = 'moda-calcados'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sandalias');

-- Sapatilhas
INSERT INTO categories (name, slug, parent_id)
SELECT 'Sapatilhas', 'sapatilhas', p.id
FROM categories p
WHERE p.slug = 'moda-calcados'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sapatilhas');

-- Chinelos
INSERT INTO categories (name, slug, parent_id)
SELECT 'Chinelos', 'chinelos', p.id
FROM categories p
WHERE p.slug = 'moda-calcados'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'chinelos');

-- Sapatos sociais
INSERT INTO categories (name, slug, parent_id)
SELECT 'Sapatos Sociais', 'sapatos-sociais', p.id
FROM categories p
WHERE p.slug = 'moda-calcados'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sapatos-sociais');

-- Required attributes (shared for calcados)
-- Botas
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material do cabedal', 'text', false
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material do cabedal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de fechamento', 'text', false
FROM categories c
WHERE c.slug = 'botas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de fechamento'
);

-- Sandalias
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material do cabedal', 'text', false
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material do cabedal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de fechamento', 'text', false
FROM categories c
WHERE c.slug = 'sandalias'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de fechamento'
);

-- Sapatilhas
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material do cabedal', 'text', false
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material do cabedal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de fechamento', 'text', false
FROM categories c
WHERE c.slug = 'sapatilhas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de fechamento'
);

-- Chinelos
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'chinelos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'chinelos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'chinelos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'chinelos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

-- Sapatos sociais
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material do cabedal', 'text', false
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material do cabedal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de fechamento', 'text', false
FROM categories c
WHERE c.slug = 'sapatos-sociais'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de fechamento'
);
