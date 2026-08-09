-- Auto-generated: missing categories and required attributes
-- Generated based on the 10-category list + current DB state

-- Parents
INSERT INTO categories (name, slug, parent_id)
SELECT 'Casa e Decoracao', 'casa-e-decoracao', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-e-decoracao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Beleza e Cuidados Pessoais', 'beleza-e-cuidados-pessoais', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-e-cuidados-pessoais');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Bebe e Infantil', 'bebe-e-infantil', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-e-infantil');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Automotivo', 'automotivo', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'automotivo');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Pet Shop', 'pet-shop', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pet-shop');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Livros e Papelaria', 'livros-e-papelaria', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'livros-e-papelaria');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Supermercado', 'supermercado', NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'supermercado');

-- Children
INSERT INTO categories (name, slug, parent_id)
SELECT 'Moda Infantil', 'moda-infantil', p.id
FROM categories p
WHERE p.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'moda-infantil');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Calcados', 'moda-calcados', p.id
FROM categories p
WHERE p.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'moda-calcados');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Acessorios', 'moda-acessorios', p.id
FROM categories p
WHERE p.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'moda-acessorios');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Moda Intima', 'moda-intima', p.id
FROM categories p
WHERE p.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'moda-intima');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Moda Esportiva', 'moda-esportiva', p.id
FROM categories p
WHERE p.slug = 'moda'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'moda-esportiva');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Computadores', 'eletronicos-computadores', p.id
FROM categories p
WHERE p.slug = 'eletronicos'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'eletronicos-computadores');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Tablets', 'eletronicos-tablets', p.id
FROM categories p
WHERE p.slug = 'eletronicos'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'eletronicos-tablets');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Moveis', 'casa-moveis', p.id
FROM categories p
WHERE p.slug = 'casa-e-decoracao'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-moveis');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Iluminacao', 'casa-iluminacao', p.id
FROM categories p
WHERE p.slug = 'casa-e-decoracao'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-iluminacao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Cozinha', 'casa-cozinha', p.id
FROM categories p
WHERE p.slug = 'casa-e-decoracao'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-cozinha');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Decoracao', 'casa-decoracao', p.id
FROM categories p
WHERE p.slug = 'casa-e-decoracao'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-decoracao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Organizacao', 'casa-organizacao', p.id
FROM categories p
WHERE p.slug = 'casa-e-decoracao'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casa-organizacao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Maquiagem', 'beleza-maquiagem', p.id
FROM categories p
WHERE p.slug = 'beleza-e-cuidados-pessoais'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-maquiagem');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Perfumes', 'beleza-perfumes', p.id
FROM categories p
WHERE p.slug = 'beleza-e-cuidados-pessoais'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-perfumes');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Cabelo', 'beleza-cabelo', p.id
FROM categories p
WHERE p.slug = 'beleza-e-cuidados-pessoais'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-cabelo');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Skincare', 'beleza-skincare', p.id
FROM categories p
WHERE p.slug = 'beleza-e-cuidados-pessoais'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-skincare');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Higiene', 'beleza-higiene', p.id
FROM categories p
WHERE p.slug = 'beleza-e-cuidados-pessoais'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beleza-higiene');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Roupas Bebe', 'bebe-roupas', p.id
FROM categories p
WHERE p.slug = 'bebe-e-infantil'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-roupas');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Brinquedos', 'bebe-brinquedos', p.id
FROM categories p
WHERE p.slug = 'bebe-e-infantil'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-brinquedos');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Alimentacao', 'bebe-alimentacao', p.id
FROM categories p
WHERE p.slug = 'bebe-e-infantil'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-alimentacao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Carrinhos', 'bebe-carrinhos', p.id
FROM categories p
WHERE p.slug = 'bebe-e-infantil'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-carrinhos');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Higiene', 'bebe-higiene', p.id
FROM categories p
WHERE p.slug = 'bebe-e-infantil'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bebe-higiene');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Fitness', 'esporte-fitness', p.id
FROM categories p
WHERE p.slug = 'esporte-e-lazer'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'esporte-fitness');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Futebol', 'esporte-futebol', p.id
FROM categories p
WHERE p.slug = 'esporte-e-lazer'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'esporte-futebol');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Ciclismo', 'esporte-ciclismo', p.id
FROM categories p
WHERE p.slug = 'esporte-e-lazer'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'esporte-ciclismo');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Camping', 'esporte-camping', p.id
FROM categories p
WHERE p.slug = 'esporte-e-lazer'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'esporte-camping');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Natacao', 'esporte-natacao', p.id
FROM categories p
WHERE p.slug = 'esporte-e-lazer'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'esporte-natacao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Pecas', 'auto-pecas', p.id
FROM categories p
WHERE p.slug = 'automotivo'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'auto-pecas');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Acessorios', 'auto-acessorios', p.id
FROM categories p
WHERE p.slug = 'automotivo'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'auto-acessorios');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Ferramentas', 'auto-ferramentas', p.id
FROM categories p
WHERE p.slug = 'automotivo'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'auto-ferramentas');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Som Automotivo', 'auto-som', p.id
FROM categories p
WHERE p.slug = 'automotivo'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'auto-som');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Racao', 'pet-racao', p.id
FROM categories p
WHERE p.slug = 'pet-shop'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pet-racao');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Brinquedos', 'pet-brinquedos', p.id
FROM categories p
WHERE p.slug = 'pet-shop'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pet-brinquedos');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Higiene', 'pet-higiene', p.id
FROM categories p
WHERE p.slug = 'pet-shop'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pet-higiene');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Acessorios', 'pet-acessorios', p.id
FROM categories p
WHERE p.slug = 'pet-shop'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pet-acessorios');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Livros', 'livros', p.id
FROM categories p
WHERE p.slug = 'livros-e-papelaria'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'livros');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Cadernos', 'papelaria-cadernos', p.id
FROM categories p
WHERE p.slug = 'livros-e-papelaria'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'papelaria-cadernos');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Escritorio', 'papelaria-escritorio', p.id
FROM categories p
WHERE p.slug = 'livros-e-papelaria'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'papelaria-escritorio');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Material Escolar', 'papelaria-material-escolar', p.id
FROM categories p
WHERE p.slug = 'livros-e-papelaria'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'papelaria-material-escolar');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Alimentos', 'supermercado-alimentos', p.id
FROM categories p
WHERE p.slug = 'supermercado'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'supermercado-alimentos');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Bebidas', 'supermercado-bebidas', p.id
FROM categories p
WHERE p.slug = 'supermercado'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'supermercado-bebidas');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Limpeza', 'supermercado-limpeza', p.id
FROM categories p
WHERE p.slug = 'supermercado'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'supermercado-limpeza');

INSERT INTO categories (name, slug, parent_id)
SELECT 'Produtos Domesticos', 'supermercado-produtos-domesticos', p.id
FROM categories p
WHERE p.slug = 'supermercado'
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'supermercado-produtos-domesticos');

-- Required attributes for new categories
INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'moda-infantil'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'moda-infantil'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'moda-infantil'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'moda-infantil'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Faixa etaria', 'text', true
FROM categories c
WHERE c.slug = 'moda-infantil'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Faixa etaria'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'moda-calcados'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho (BR)', 'number', true
FROM categories c
WHERE c.slug = 'moda-calcados'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho (BR)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'moda-calcados'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'moda-calcados'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material do cabedal', 'text', true
FROM categories c
WHERE c.slug = 'moda-calcados'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material do cabedal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'moda-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'moda-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'moda-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'moda-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'moda-intima'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'moda-intima'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'moda-intima'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'moda-intima'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'moda-intima'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Esporte', 'text', true
FROM categories c
WHERE c.slug = 'moda-esportiva'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Esporte'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Modelo', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Modelo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Processador', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Processador'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Memoria RAM (GB)', 'number', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Memoria RAM (GB)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Armazenamento (GB)', 'number', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Armazenamento (GB)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de armazenamento', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de armazenamento'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-computadores'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Modelo', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Modelo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho da tela (pol)', 'number', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho da tela (pol)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Armazenamento (GB)', 'number', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Armazenamento (GB)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Memoria RAM (GB)', 'number', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Memoria RAM (GB)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conectividade', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conectividade'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'eletronicos-tablets'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'casa-moveis'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'casa-moveis'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Largura (cm)', 'number', true
FROM categories c
WHERE c.slug = 'casa-moveis'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Largura (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Altura (cm)', 'number', true
FROM categories c
WHERE c.slug = 'casa-moveis'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Altura (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Profundidade (cm)', 'number', true
FROM categories c
WHERE c.slug = 'casa-moveis'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Profundidade (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de luminaria', 'text', true
FROM categories c
WHERE c.slug = 'casa-iluminacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de luminaria'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de lampada', 'text', true
FROM categories c
WHERE c.slug = 'casa-iluminacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de lampada'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Potencia (W)', 'number', true
FROM categories c
WHERE c.slug = 'casa-iluminacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Potencia (W)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Voltagem', 'number', true
FROM categories c
WHERE c.slug = 'casa-iluminacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Voltagem'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'casa-iluminacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'casa-cozinha'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'casa-cozinha'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'casa-cozinha'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'casa-decoracao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'casa-decoracao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Dimensoes (cm)', 'text', true
FROM categories c
WHERE c.slug = 'casa-decoracao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Dimensoes (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'casa-organizacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'casa-organizacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Dimensoes (cm)', 'text', true
FROM categories c
WHERE c.slug = 'casa-organizacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Dimensoes (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'beleza-maquiagem'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'beleza-maquiagem'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conteudo (ml/g)', 'text', true
FROM categories c
WHERE c.slug = 'beleza-maquiagem'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conteudo (ml/g)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'beleza-perfumes'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'beleza-perfumes'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Familia olfativa', 'text', true
FROM categories c
WHERE c.slug = 'beleza-perfumes'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Familia olfativa'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'beleza-perfumes'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'beleza-cabelo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de cabelo', 'text', true
FROM categories c
WHERE c.slug = 'beleza-cabelo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de cabelo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'beleza-cabelo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'beleza-cabelo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'beleza-skincare'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de pele', 'text', true
FROM categories c
WHERE c.slug = 'beleza-skincare'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de pele'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'beleza-skincare'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'beleza-skincare'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'beleza-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'beleza-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Fragrancia', 'text', true
FROM categories c
WHERE c.slug = 'beleza-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Fragrancia'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'beleza-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'bebe-roupas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'bebe-roupas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'bebe-roupas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Genero', 'text', true
FROM categories c
WHERE c.slug = 'bebe-roupas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Genero'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Faixa etaria', 'text', true
FROM categories c
WHERE c.slug = 'bebe-roupas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Faixa etaria'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de brinquedo', 'text', true
FROM categories c
WHERE c.slug = 'bebe-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de brinquedo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Idade recomendada', 'text', true
FROM categories c
WHERE c.slug = 'bebe-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Idade recomendada'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'bebe-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'bebe-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'bebe-alimentacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conteudo (ml/g)', 'text', true
FROM categories c
WHERE c.slug = 'bebe-alimentacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conteudo (ml/g)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Faixa etaria', 'text', true
FROM categories c
WHERE c.slug = 'bebe-alimentacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Faixa etaria'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'bebe-alimentacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'bebe-carrinhos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Capacidade de peso (kg)', 'number', true
FROM categories c
WHERE c.slug = 'bebe-carrinhos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Capacidade de peso (kg)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'bebe-carrinhos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'bebe-carrinhos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'bebe-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conteudo (ml/g)', 'text', true
FROM categories c
WHERE c.slug = 'bebe-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conteudo (ml/g)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Faixa etaria', 'text', true
FROM categories c
WHERE c.slug = 'bebe-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Faixa etaria'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'bebe-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'esporte-fitness'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'esporte-fitness'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'esporte-fitness'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'esporte-fitness'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'esporte-futebol'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'esporte-futebol'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'esporte-futebol'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'esporte-futebol'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'esporte-ciclismo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'esporte-ciclismo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'esporte-ciclismo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'esporte-ciclismo'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'esporte-camping'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'esporte-camping'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Dimensoes (cm)', 'text', true
FROM categories c
WHERE c.slug = 'esporte-camping'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Dimensoes (cm)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'esporte-camping'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'esporte-natacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'esporte-natacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'esporte-natacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'esporte-natacao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de peca', 'text', true
FROM categories c
WHERE c.slug = 'auto-pecas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de peca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Compatibilidade', 'text', true
FROM categories c
WHERE c.slug = 'auto-pecas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Compatibilidade'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'auto-pecas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'auto-pecas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de acessorio', 'text', true
FROM categories c
WHERE c.slug = 'auto-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de acessorio'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Compatibilidade', 'text', true
FROM categories c
WHERE c.slug = 'auto-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Compatibilidade'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'auto-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'auto-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de ferramenta', 'text', true
FROM categories c
WHERE c.slug = 'auto-ferramentas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de ferramenta'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'auto-ferramentas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'auto-ferramentas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'auto-ferramentas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo', 'text', true
FROM categories c
WHERE c.slug = 'auto-som'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Potencia (W)', 'number', true
FROM categories c
WHERE c.slug = 'auto-som'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Potencia (W)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Compatibilidade', 'text', true
FROM categories c
WHERE c.slug = 'auto-som'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Compatibilidade'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'auto-som'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de animal', 'text', true
FROM categories c
WHERE c.slug = 'pet-racao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de animal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Porte do animal', 'text', true
FROM categories c
WHERE c.slug = 'pet-racao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Porte do animal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Sabor', 'text', true
FROM categories c
WHERE c.slug = 'pet-racao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Sabor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Peso (kg)', 'number', true
FROM categories c
WHERE c.slug = 'pet-racao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Peso (kg)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'pet-racao'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de brinquedo', 'text', true
FROM categories c
WHERE c.slug = 'pet-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de brinquedo'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'pet-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Porte do animal', 'text', true
FROM categories c
WHERE c.slug = 'pet-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Porte do animal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'pet-brinquedos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'pet-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'pet-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de animal', 'text', true
FROM categories c
WHERE c.slug = 'pet-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de animal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'pet-higiene'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de acessorio', 'text', true
FROM categories c
WHERE c.slug = 'pet-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de acessorio'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'pet-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Porte do animal', 'text', true
FROM categories c
WHERE c.slug = 'pet-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Porte do animal'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'pet-acessorios'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Autor', 'text', true
FROM categories c
WHERE c.slug = 'livros'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Autor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'ISBN', 'text', true
FROM categories c
WHERE c.slug = 'livros'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'ISBN'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Idioma', 'text', true
FROM categories c
WHERE c.slug = 'livros'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Idioma'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Editora', 'text', true
FROM categories c
WHERE c.slug = 'livros'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Editora'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Numero de folhas', 'number', true
FROM categories c
WHERE c.slug = 'papelaria-cadernos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Numero de folhas'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-cadernos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de capa', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-cadernos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de capa'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-cadernos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-escritorio'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-escritorio'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-escritorio'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-escritorio'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-material-escolar'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-material-escolar'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tamanho', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-material-escolar'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tamanho'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Cor', 'text', true
FROM categories c
WHERE c.slug = 'papelaria-material-escolar'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Cor'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-alimentos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-alimentos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conteudo (ml/g)', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-alimentos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conteudo (ml/g)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de bebida', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-bebidas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de bebida'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-bebidas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Volume (ml)', 'number', true
FROM categories c
WHERE c.slug = 'supermercado-bebidas'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Volume (ml)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-limpeza'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-limpeza'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Conteudo (ml/g)', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-limpeza'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Conteudo (ml/g)'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Tipo de produto', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-produtos-domesticos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Tipo de produto'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Marca', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-produtos-domesticos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Marca'
);

INSERT INTO category_attributes (category_id, name, data_type, is_required)
SELECT c.id, 'Material', 'text', true
FROM categories c
WHERE c.slug = 'supermercado-produtos-domesticos'
AND NOT EXISTS (
  SELECT 1 FROM category_attributes a
  WHERE a.category_id = c.id AND a.name = 'Material'
);
