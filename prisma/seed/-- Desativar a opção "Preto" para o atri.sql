-- Desativar a opção "Preto" para o atributo "Cor"
UPDATE attribute_options o
SET is_active = false
FROM category_attributes a
WHERE o.attribute_id = a.id
  AND a.name ILIKE 'Cor'
  AND o.value = 'Preto';


UPDATE attribute_options o
SET is_active = true
FROM category_attributes a
WHERE o.attribute_id = a.id
  AND a.name ILIKE 'Cor'
  AND o.value = 'Preto';


UPDATE attribute_options o
SET is_active = false
FROM category_attributes a
WHERE o.attribute_id = a.id
  AND a.name ILIKE 'Cor'
  AND o.value IN ('Rosa', 'Roxo', 'Laranja');


SELECT a.name AS atributo, o.value, o.is_active
FROM attribute_options o
JOIN category_attributes a ON a.id = o.attribute_id
WHERE a.name ILIKE 'Cor'
ORDER BY o.is_active DESC, o.value;
