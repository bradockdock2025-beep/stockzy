-- Seed: categories and category_attributes (schema-aligned)
-- Compatible with:
-- categories(id uuid pk default gen_random_uuid(), name, slug, parent_id, ...)
-- category_attributes(id uuid pk default gen_random_uuid(), category_id, name, data_type, is_required, ...)

WITH
cat_smartphones AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Celulares e Smartphones', 'celulares-e-smartphones', NULL)
  RETURNING id
),
cat_tenis AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Tenis Esportivos', 'tenis-esportivos', NULL)
  RETURNING id
),
cat_notebooks AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Notebooks', 'notebooks', NULL)
  RETURNING id
)
INSERT INTO category_attributes (category_id, name, data_type, is_required)
-- Smartphones
SELECT id, 'Marca', 'text', true FROM cat_smartphones
UNION ALL SELECT id, 'Modelo', 'text', true FROM cat_smartphones
UNION ALL SELECT id, 'Capacidade de armazenamento (GB)', 'number', true FROM cat_smartphones
UNION ALL SELECT id, 'Memoria RAM (GB)', 'number', true FROM cat_smartphones
UNION ALL SELECT id, 'Cor', 'text', true FROM cat_smartphones
UNION ALL SELECT id, '5G', 'boolean', false FROM cat_smartphones
UNION ALL SELECT id, 'Dual SIM', 'boolean', false FROM cat_smartphones
UNION ALL SELECT id, 'Condicao', 'text', true FROM cat_smartphones

-- Tenis Esportivos
UNION ALL SELECT id, 'Marca', 'text', true FROM cat_tenis
UNION ALL SELECT id, 'Tamanho (BR)', 'number', true FROM cat_tenis
UNION ALL SELECT id, 'Cor', 'text', true FROM cat_tenis
UNION ALL SELECT id, 'Genero', 'text', true FROM cat_tenis
UNION ALL SELECT id, 'Material do cabedal', 'text', false FROM cat_tenis
UNION ALL SELECT id, 'Tipo de fechamento', 'text', false FROM cat_tenis
UNION ALL SELECT id, 'Indicado para', 'text', false FROM cat_tenis

-- Notebooks
UNION ALL SELECT id, 'Marca', 'text', true FROM cat_notebooks
UNION ALL SELECT id, 'Modelo', 'text', true FROM cat_notebooks
UNION ALL SELECT id, 'Processador', 'text', true FROM cat_notebooks
UNION ALL SELECT id, 'Memoria RAM (GB)', 'number', true FROM cat_notebooks
UNION ALL SELECT id, 'Armazenamento (GB)', 'number', true FROM cat_notebooks
UNION ALL SELECT id, 'Tipo de armazenamento', 'text', true FROM cat_notebooks
UNION ALL SELECT id, 'Tamanho da tela (pol)', 'number', true FROM cat_notebooks
UNION ALL SELECT id, 'Sistema operacional', 'text', false FROM cat_notebooks
;
