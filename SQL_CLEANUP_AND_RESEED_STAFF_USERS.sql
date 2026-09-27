-- Remove os 2 usuários de teste criados pra validar o P0/P1/P2.1 do
-- PLANO_IMPLEMENTACAO_AJUSTES_BACKEND_GESTAO.md (admin.teste@stockzy.local,
-- support.teste@stockzy.local) e recria os mesmos 2 papéis com nome/email mais formal.
-- Ainda é dado de dev (projeto não está em produção) — senha em bcrypt (10 rounds,
-- mesmo padrão de SQL_SEED_TEST_ADMIN_USER.sql), gerada com o mesmo pacote `bcrypt`
-- que o app usa.
--
-- 1) Limpeza dos usuários de teste antigos
-- 2) Novos usuários:
--
--   Administrador Stockzy   | admin@stockzy.com    | Stockzy@Admin2026    | role: admin
--   Suporte Stockzy         | suporte@stockzy.com  | Stockzy@Suporte2026  | role: support
--
-- Idempotente (DELETE por email específico + INSERT ON CONFLICT DO NOTHING por email).

DELETE FROM users
WHERE email IN ('admin.teste@stockzy.local', 'support.teste@stockzy.local');

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'Administrador Stockzy',
    'admin@stockzy.com',
    '$2b$10$lAvGhNyqfCm/i5Fi3iAZVuU2RJSzVWJPZlFCMQiLiJX5R6nlecN0W',
    'admin',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Suporte Stockzy',
    'suporte@stockzy.com',
    '$2b$10$noCN9.bNYpxk3CtWpX5LmeReIE9Bw1Fy1K5BvlvjFeGAkgciluHW.',
    'support',
    true,
    now(),
    now()
  )
ON CONFLICT (email) DO NOTHING;
