-- Seed extra categories and attributes (professional set)
-- Safe to re-run: categories upsert by slug, attributes inserted if missing.

WITH
parent_eletronicos AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Eletronicos', 'eletronicos', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_eletrodomesticos AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Eletrodomesticos', 'eletrodomesticos', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_moda AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Moda', 'moda', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_informatica AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Informatica', 'informatica', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_audio AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Audio e Som', 'audio-e-som', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_games AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Games', 'games', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
parent_esporte AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Esporte e Lazer', 'esporte-e-lazer', NULL)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_tvs AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('TVs e Video', 'tvs-e-video', (SELECT id FROM parent_eletronicos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_cameras AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Cameras Digitais', 'cameras-digitais', (SELECT id FROM parent_eletronicos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_smartwatches AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Smartwatches', 'smartwatches', (SELECT id FROM parent_eletronicos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_fones AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Fones de Ouvido', 'fones-de-ouvido', (SELECT id FROM parent_audio))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_refrigeradores AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Refrigeradores', 'refrigeradores', (SELECT id FROM parent_eletrodomesticos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_lavadoras AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Maquinas de Lavar', 'maquinas-de-lavar', (SELECT id FROM parent_eletrodomesticos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_microondas AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Microondas', 'microondas', (SELECT id FROM parent_eletrodomesticos))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_consoles AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Consoles e Jogos', 'consoles-e-jogos', (SELECT id FROM parent_games))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_monitores AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Monitores', 'monitores', (SELECT id FROM parent_informatica))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_roupas_m AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Roupas Masculinas', 'roupas-masculinas', (SELECT id FROM parent_moda))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_roupas_f AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Roupas Femininas', 'roupas-femininas', (SELECT id FROM parent_moda))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
cat_bicicletas AS (
  INSERT INTO categories (name, slug, parent_id)
  VALUES ('Bicicletas', 'bicicletas', (SELECT id FROM parent_esporte))
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO category_attributes (category_id, name, data_type, is_required)
-- TVs e Video
SELECT cat_tvs.id, 'Marca', 'text', true FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Marca'
)
UNION ALL SELECT cat_tvs.id, 'Modelo', 'text', true FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Modelo'
)
UNION ALL SELECT cat_tvs.id, 'Tamanho da tela (pol)', 'number', true FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Tamanho da tela (pol)'
)
UNION ALL SELECT cat_tvs.id, 'Resolucao', 'text', true FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Resolucao'
)
UNION ALL SELECT cat_tvs.id, 'Smart TV', 'boolean', true FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Smart TV'
)
UNION ALL SELECT cat_tvs.id, 'Tipo de painel', 'text', false FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'Tipo de painel'
)
UNION ALL SELECT cat_tvs.id, 'HDMI (quantidade)', 'number', false FROM cat_tvs
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_tvs.id AND name = 'HDMI (quantidade)'
)

-- Cameras Digitais
UNION ALL SELECT cat_cameras.id, 'Marca', 'text', true FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Marca'
)
UNION ALL SELECT cat_cameras.id, 'Modelo', 'text', true FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Modelo'
)
UNION ALL SELECT cat_cameras.id, 'Megapixels', 'number', true FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Megapixels'
)
UNION ALL SELECT cat_cameras.id, 'Zoom optico (x)', 'number', false FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Zoom optico (x)'
)
UNION ALL SELECT cat_cameras.id, 'Tipo de camera', 'text', true FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Tipo de camera'
)
UNION ALL SELECT cat_cameras.id, 'Resolucao de video', 'text', false FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Resolucao de video'
)
UNION ALL SELECT cat_cameras.id, 'Wi-Fi', 'boolean', false FROM cat_cameras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_cameras.id AND name = 'Wi-Fi'
)

-- Smartwatches
UNION ALL SELECT cat_smartwatches.id, 'Marca', 'text', true FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Marca'
)
UNION ALL SELECT cat_smartwatches.id, 'Modelo', 'text', true FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Modelo'
)
UNION ALL SELECT cat_smartwatches.id, 'Tamanho da tela (pol)', 'number', false FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Tamanho da tela (pol)'
)
UNION ALL SELECT cat_smartwatches.id, 'GPS', 'boolean', false FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'GPS'
)
UNION ALL SELECT cat_smartwatches.id, 'Resistencia a agua', 'boolean', false FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Resistencia a agua'
)
UNION ALL SELECT cat_smartwatches.id, 'Compatibilidade', 'text', true FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Compatibilidade'
)
UNION ALL SELECT cat_smartwatches.id, 'Material da pulseira', 'text', false FROM cat_smartwatches
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_smartwatches.id AND name = 'Material da pulseira'
)

-- Fones de Ouvido
UNION ALL SELECT cat_fones.id, 'Marca', 'text', true FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Marca'
)
UNION ALL SELECT cat_fones.id, 'Modelo', 'text', true FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Modelo'
)
UNION ALL SELECT cat_fones.id, 'Tipo', 'text', true FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Tipo'
)
UNION ALL SELECT cat_fones.id, 'Conectividade', 'text', true FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Conectividade'
)
UNION ALL SELECT cat_fones.id, 'Cancelamento de ruido', 'boolean', false FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Cancelamento de ruido'
)
UNION ALL SELECT cat_fones.id, 'Microfone', 'boolean', false FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Microfone'
)
UNION ALL SELECT cat_fones.id, 'Cor', 'text', false FROM cat_fones
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_fones.id AND name = 'Cor'
)

-- Refrigeradores
UNION ALL SELECT cat_refrigeradores.id, 'Marca', 'text', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Marca'
)
UNION ALL SELECT cat_refrigeradores.id, 'Modelo', 'text', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Modelo'
)
UNION ALL SELECT cat_refrigeradores.id, 'Capacidade (L)', 'number', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Capacidade (L)'
)
UNION ALL SELECT cat_refrigeradores.id, 'Frost Free', 'boolean', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Frost Free'
)
UNION ALL SELECT cat_refrigeradores.id, 'Quantidade de portas', 'number', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Quantidade de portas'
)
UNION ALL SELECT cat_refrigeradores.id, 'Cor', 'text', true FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Cor'
)
UNION ALL SELECT cat_refrigeradores.id, 'Eficiencia energetica', 'text', false FROM cat_refrigeradores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_refrigeradores.id AND name = 'Eficiencia energetica'
)

-- Maquinas de Lavar
UNION ALL SELECT cat_lavadoras.id, 'Marca', 'text', true FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Marca'
)
UNION ALL SELECT cat_lavadoras.id, 'Modelo', 'text', true FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Modelo'
)
UNION ALL SELECT cat_lavadoras.id, 'Capacidade (kg)', 'number', true FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Capacidade (kg)'
)
UNION ALL SELECT cat_lavadoras.id, 'Tipo de abertura', 'text', true FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Tipo de abertura'
)
UNION ALL SELECT cat_lavadoras.id, 'Inverter', 'boolean', false FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Inverter'
)
UNION ALL SELECT cat_lavadoras.id, 'Cor', 'text', false FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Cor'
)
UNION ALL SELECT cat_lavadoras.id, 'Voltagem', 'number', false FROM cat_lavadoras
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_lavadoras.id AND name = 'Voltagem'
)

-- Microondas
UNION ALL SELECT cat_microondas.id, 'Marca', 'text', true FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Marca'
)
UNION ALL SELECT cat_microondas.id, 'Modelo', 'text', true FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Modelo'
)
UNION ALL SELECT cat_microondas.id, 'Capacidade (L)', 'number', true FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Capacidade (L)'
)
UNION ALL SELECT cat_microondas.id, 'Potencia (W)', 'number', false FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Potencia (W)'
)
UNION ALL SELECT cat_microondas.id, 'Cor', 'text', false FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Cor'
)
UNION ALL SELECT cat_microondas.id, 'Grill', 'boolean', false FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Grill'
)
UNION ALL SELECT cat_microondas.id, 'Voltagem', 'number', false FROM cat_microondas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_microondas.id AND name = 'Voltagem'
)

-- Consoles e Jogos
UNION ALL SELECT cat_consoles.id, 'Marca', 'text', true FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Marca'
)
UNION ALL SELECT cat_consoles.id, 'Modelo', 'text', true FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Modelo'
)
UNION ALL SELECT cat_consoles.id, 'Armazenamento (GB)', 'number', true FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Armazenamento (GB)'
)
UNION ALL SELECT cat_consoles.id, 'Inclui jogo', 'boolean', false FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Inclui jogo'
)
UNION ALL SELECT cat_consoles.id, 'Cor', 'text', false FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Cor'
)
UNION ALL SELECT cat_consoles.id, 'Condicao', 'text', true FROM cat_consoles
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_consoles.id AND name = 'Condicao'
)

-- Monitores
UNION ALL SELECT cat_monitores.id, 'Marca', 'text', true FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Marca'
)
UNION ALL SELECT cat_monitores.id, 'Modelo', 'text', true FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Modelo'
)
UNION ALL SELECT cat_monitores.id, 'Tamanho (pol)', 'number', true FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Tamanho (pol)'
)
UNION ALL SELECT cat_monitores.id, 'Resolucao', 'text', true FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Resolucao'
)
UNION ALL SELECT cat_monitores.id, 'Taxa de atualizacao (Hz)', 'number', false FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Taxa de atualizacao (Hz)'
)
UNION ALL SELECT cat_monitores.id, 'Tipo de painel', 'text', false FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Tipo de painel'
)
UNION ALL SELECT cat_monitores.id, 'Conexao HDMI', 'boolean', false FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Conexao HDMI'
)
UNION ALL SELECT cat_monitores.id, 'Conexao DisplayPort', 'boolean', false FROM cat_monitores
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_monitores.id AND name = 'Conexao DisplayPort'
)

-- Roupas Masculinas
UNION ALL SELECT cat_roupas_m.id, 'Marca', 'text', true FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Marca'
)
UNION ALL SELECT cat_roupas_m.id, 'Tamanho', 'text', true FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Tamanho'
)
UNION ALL SELECT cat_roupas_m.id, 'Cor', 'text', true FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Cor'
)
UNION ALL SELECT cat_roupas_m.id, 'Material', 'text', false FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Material'
)
UNION ALL SELECT cat_roupas_m.id, 'Tipo de manga', 'text', false FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Tipo de manga'
)
UNION ALL SELECT cat_roupas_m.id, 'Ocasiao', 'text', false FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Ocasiao'
)
UNION ALL SELECT cat_roupas_m.id, 'Genero', 'text', true FROM cat_roupas_m
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_m.id AND name = 'Genero'
)

-- Roupas Femininas
UNION ALL SELECT cat_roupas_f.id, 'Marca', 'text', true FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Marca'
)
UNION ALL SELECT cat_roupas_f.id, 'Tamanho', 'text', true FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Tamanho'
)
UNION ALL SELECT cat_roupas_f.id, 'Cor', 'text', true FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Cor'
)
UNION ALL SELECT cat_roupas_f.id, 'Material', 'text', false FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Material'
)
UNION ALL SELECT cat_roupas_f.id, 'Tipo', 'text', false FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Tipo'
)
UNION ALL SELECT cat_roupas_f.id, 'Comprimento', 'text', false FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Comprimento'
)
UNION ALL SELECT cat_roupas_f.id, 'Genero', 'text', true FROM cat_roupas_f
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_roupas_f.id AND name = 'Genero'
)

-- Bicicletas
UNION ALL SELECT cat_bicicletas.id, 'Marca', 'text', true FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Marca'
)
UNION ALL SELECT cat_bicicletas.id, 'Modelo', 'text', true FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Modelo'
)
UNION ALL SELECT cat_bicicletas.id, 'Aro', 'number', true FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Aro'
)
UNION ALL SELECT cat_bicicletas.id, 'Material do quadro', 'text', false FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Material do quadro'
)
UNION ALL SELECT cat_bicicletas.id, 'Tipo', 'text', true FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Tipo'
)
UNION ALL SELECT cat_bicicletas.id, 'Freio a disco', 'boolean', false FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Freio a disco'
)
UNION ALL SELECT cat_bicicletas.id, 'Cor', 'text', false FROM cat_bicicletas
WHERE NOT EXISTS (
  SELECT 1 FROM category_attributes WHERE category_id = cat_bicicletas.id AND name = 'Cor'
)
;
