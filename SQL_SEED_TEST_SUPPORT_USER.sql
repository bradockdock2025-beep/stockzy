-- Cria um usuário de staff de teste (role support), pra validar ao vivo o P0.2 do
-- PLANO_IMPLEMENTACAO_AJUSTES_BACKEND_GESTAO.md: support deve conseguir LER
-- admin/orders e admin/customers, e receber 403 em qualquer escrita, em qualquer módulo.
--
-- Senha já com hash bcrypt (10 rounds), mesmo padrão de SQL_SEED_TEST_ADMIN_USER.sql.
--
--   email:    support.teste@stockzy.local
--   senha:    TesteSupport2026!
--   role:     support (leitura de pedidos/clientes, sem escrita em nada)
--
-- Idempotente (ON CONFLICT DO NOTHING por email).

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Support de Teste',
  'support.teste@stockzy.local',
  '$2b$10$DkUXoWjme2RTQf42qkiI2.6YQmsOKSwyilBXHpw3D8IAM5PmhenUW',
  'support',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;
