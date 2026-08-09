-- SKU setup (categories codes + sequences table)

ALTER TABLE categories ADD COLUMN IF NOT EXISTS code text;

CREATE TABLE IF NOT EXISTS sku_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE,
  last_number integer NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

-- Category codes (safe to re-run)
UPDATE categories
SET code = 'MOD'
WHERE slug = 'moda' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ELE'
WHERE slug = 'eletronicos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAS'
WHERE slug = 'casa-e-decoracao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BEL'
WHERE slug = 'beleza-e-cuidados-pessoais' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BEB'
WHERE slug = 'bebe-e-infantil' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ESP'
WHERE slug = 'esporte-e-lazer' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'AUT'
WHERE slug = 'automotivo' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'PET'
WHERE slug = 'pet-shop' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'LIV'
WHERE slug = 'livros-e-papelaria' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SUP'
WHERE slug = 'supermercado' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ELD'
WHERE slug = 'eletrodomesticos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'INF'
WHERE slug = 'informatica' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'AUD'
WHERE slug = 'audio-e-som' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'GAM'
WHERE slug = 'games' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CEL'
WHERE slug = 'celulares-e-smartphones' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'NOT'
WHERE slug = 'notebooks' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'TEN'
WHERE slug = 'tenis-esportivos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'FEM'
WHERE slug = 'roupas-femininas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MAS'
WHERE slug = 'roupas-masculinas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'INF'
WHERE slug = 'moda-infantil' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAL'
WHERE slug = 'moda-calcados' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ACE'
WHERE slug = 'moda-acessorios' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'INT'
WHERE slug = 'moda-intima' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ESP'
WHERE slug = 'moda-esportiva' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'COM'
WHERE slug = 'eletronicos-computadores' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'TAB'
WHERE slug = 'eletronicos-tablets' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'TVS'
WHERE slug = 'tvs-e-video' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAM'
WHERE slug = 'cameras-digitais' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SWT'
WHERE slug = 'smartwatches' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'FON'
WHERE slug = 'fones-de-ouvido' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CON'
WHERE slug = 'consoles-e-jogos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MON'
WHERE slug = 'monitores' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'REF'
WHERE slug = 'refrigeradores' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'LAV'
WHERE slug = 'maquinas-de-lavar' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MIC'
WHERE slug = 'microondas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BIC'
WHERE slug = 'bicicletas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MOV'
WHERE slug = 'casa-moveis' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ILU'
WHERE slug = 'casa-iluminacao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'COZ'
WHERE slug = 'casa-cozinha' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'DEC'
WHERE slug = 'casa-decoracao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ORG'
WHERE slug = 'casa-organizacao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MAQ'
WHERE slug = 'beleza-maquiagem' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'PER'
WHERE slug = 'beleza-perfumes' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAB'
WHERE slug = 'beleza-cabelo' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SKI'
WHERE slug = 'beleza-skincare' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'HIG'
WHERE slug = 'beleza-higiene' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ROP'
WHERE slug = 'bebe-roupas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BRI'
WHERE slug = 'bebe-brinquedos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ALI'
WHERE slug = 'bebe-alimentacao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAR'
WHERE slug = 'bebe-carrinhos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'HIG'
WHERE slug = 'bebe-higiene' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'FIT'
WHERE slug = 'esporte-fitness' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'FUT'
WHERE slug = 'esporte-futebol' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CIC'
WHERE slug = 'esporte-ciclismo' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CMP'
WHERE slug = 'esporte-camping' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'NAT'
WHERE slug = 'esporte-natacao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'PEC'
WHERE slug = 'auto-pecas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ACE'
WHERE slug = 'auto-acessorios' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'FER'
WHERE slug = 'auto-ferramentas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SOM'
WHERE slug = 'auto-som' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'RAC'
WHERE slug = 'pet-racao' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BRI'
WHERE slug = 'pet-brinquedos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'HIG'
WHERE slug = 'pet-higiene' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ACE'
WHERE slug = 'pet-acessorios' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'LIV'
WHERE slug = 'livros' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CAD'
WHERE slug = 'papelaria-cadernos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ESC'
WHERE slug = 'papelaria-escritorio' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'MAT'
WHERE slug = 'papelaria-material-escolar' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'ALI'
WHERE slug = 'supermercado-alimentos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'BEB'
WHERE slug = 'supermercado-bebidas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'LIM'
WHERE slug = 'supermercado-limpeza' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'DOM'
WHERE slug = 'supermercado-produtos-domesticos' AND (code IS NULL OR code = '');

-- Moda > Calcados extras
UPDATE categories
SET code = 'BOT'
WHERE slug = 'botas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SAN'
WHERE slug = 'sandalias' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SPT'
WHERE slug = 'sapatilhas' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'CHI'
WHERE slug = 'chinelos' AND (code IS NULL OR code = '');

UPDATE categories
SET code = 'SOC'
WHERE slug = 'sapatos-sociais' AND (code IS NULL OR code = '');
