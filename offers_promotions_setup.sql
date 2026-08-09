DO $$
DECLARE
  v_promo_dia    UUID;
  v_promo_semana UUID;
  v_promo_mes    UUID;
BEGIN

  -- ============================================================
  -- PROMOÇÃO 1: Oferta do Dia
  -- Desconto: 15% | Expira: hoje às 23:59
  -- Categorias: TVs e Vídeo, Consoles e Jogos, Fones de Ouvido, Câmeras Digitais
  -- ============================================================
  INSERT INTO promotions (
    id, name, type, value, is_active,
    starts_at, ends_at, priority, label,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    'Oferta do Dia',
    'percent',
    15,
    true,
    now(),
    CURRENT_DATE + INTERVAL '23 hours 59 minutes 59 seconds',
    10,
    'oferta_do_dia',
    now(), now()
  )
  RETURNING id INTO v_promo_dia;

  INSERT INTO promotion_targets (id, promotion_id, target_type, category_id, created_at)
  VALUES
    (gen_random_uuid(), v_promo_dia, 'category', '3ed98244-c5a9-4a78-8922-e9d290739ba5', now()),  -- TVs e Video
    (gen_random_uuid(), v_promo_dia, 'category', '1e91e754-ed10-4b6c-a68c-0349efe31a5e', now()),  -- Consoles e Jogos
    (gen_random_uuid(), v_promo_dia, 'category', '2ef95762-30f7-486c-b8b2-8c988cd79611', now()),  -- Fones de Ouvido
    (gen_random_uuid(), v_promo_dia, 'category', 'cd06a932-9eb6-49f4-abb6-1def23c38f1d', now());  -- Cameras Digitais


  -- ============================================================
  -- PROMOÇÃO 2: Semana de Ofertas
  -- Desconto: 20% | Expira: em 7 dias às 23:59
  -- Categorias: Smartwatches, Tablets, Fitness, Maquiagem, Skincare, Perfumes
  -- ============================================================
  INSERT INTO promotions (
    id, name, type, value, is_active,
    starts_at, ends_at, priority, label,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    'Semana de Ofertas',
    'percent',
    20,
    true,
    now(),
    CURRENT_DATE + INTERVAL '7 days 23 hours 59 minutes 59 seconds',
    5,
    'oferta',
    now(), now()
  )
  RETURNING id INTO v_promo_semana;

  INSERT INTO promotion_targets (id, promotion_id, target_type, category_id, created_at)
  VALUES
    (gen_random_uuid(), v_promo_semana, 'category', '5060187d-93ff-40f9-bf92-eaa0b999e35f', now()),  -- Smartwatches
    (gen_random_uuid(), v_promo_semana, 'category', '6761b65d-4373-4ea0-97ec-18a2a771948d', now()),  -- Tablets
    (gen_random_uuid(), v_promo_semana, 'category', '33609934-dfc2-436f-beea-d8186740aea0', now()),  -- Fitness
    (gen_random_uuid(), v_promo_semana, 'category', '3e0f0ac1-3a45-488c-ad67-9c885f0ad884', now()),  -- Maquiagem
    (gen_random_uuid(), v_promo_semana, 'category', '906283e3-959c-4dda-9aeb-a8e81f014e1c', now()),  -- Skincare
    (gen_random_uuid(), v_promo_semana, 'category', 'a285b407-af21-466b-8e57-a892c457be83', now());  -- Perfumes


  -- ============================================================
  -- PROMOÇÃO 3: Ofertas do Mês
  -- Desconto: 10% | Expira: em 30 dias às 23:59
  -- Categorias: Bicicletas, Computadores, Refrigeradores, Máquinas de Lavar,
  --             Micro-ondas, Futebol, Natação, Ciclismo, Camping
  -- ============================================================
  INSERT INTO promotions (
    id, name, type, value, is_active,
    starts_at, ends_at, priority, label,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    'Ofertas do Mês',
    'percent',
    10,
    true,
    now(),
    CURRENT_DATE + INTERVAL '30 days 23 hours 59 minutes 59 seconds',
    3,
    'oferta',
    now(), now()
  )
  RETURNING id INTO v_promo_mes;

  INSERT INTO promotion_targets (id, promotion_id, target_type, category_id, created_at)
  VALUES
    (gen_random_uuid(), v_promo_mes, 'category', '93a6e2e6-2e6d-49d6-abf4-86e90391a083', now()),  -- Bicicletas
    (gen_random_uuid(), v_promo_mes, 'category', 'd1d75b31-dbad-4ab7-89f3-1ceb20767c88', now()),  -- Computadores
    (gen_random_uuid(), v_promo_mes, 'category', '01d2d1d9-95ec-4a8a-b853-a1ac2152bfb6', now()),  -- Refrigeradores
    (gen_random_uuid(), v_promo_mes, 'category', '4e4b1227-c73f-405c-953b-a01daa105bfc', now()),  -- Maquinas de Lavar
    (gen_random_uuid(), v_promo_mes, 'category', 'e1de31b6-8290-4247-bc16-edab124f9b17', now()),  -- Microondas
    (gen_random_uuid(), v_promo_mes, 'category', '55c5fca1-05fd-4045-b526-5a5758e5b5c0', now()),  -- Futebol
    (gen_random_uuid(), v_promo_mes, 'category', '0643a355-634a-4864-aa2b-2f53408509be', now()),  -- Natacao
    (gen_random_uuid(), v_promo_mes, 'category', 'c6a940a1-8461-46ff-83b0-53a3e8f5c955', now()),  -- Ciclismo
    (gen_random_uuid(), v_promo_mes, 'category', '146e4ab3-211a-429c-b870-783791e2bde8', now());  -- Camping

  RAISE NOTICE 'Promoções inseridas com sucesso: %, %, %', v_promo_dia, v_promo_semana, v_promo_mes;

END $$;


-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT
  p.name         AS promotion,
  p.label,
  p.value        AS discount_pct,
  p.ends_at,
  COUNT(pt.id)   AS total_targets
FROM promotions p
JOIN promotion_targets pt ON pt.promotion_id = p.id
WHERE p.label IN ('oferta_do_dia', 'oferta')
GROUP BY p.id, p.name, p.label, p.value, p.ends_at
ORDER BY p.label;
