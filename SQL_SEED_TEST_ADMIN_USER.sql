-- Cria um usuário de staff de teste (role admin), pra validar ao vivo o P0.1 (auditoria)
-- do PLANO_IMPLEMENTACAO_AJUSTES_BACKEND_GESTAO.md — hoje não existe NENHUM usuário na
-- tabela `users` (confirmado via SELECT direto no banco real, 2026-09-26), então nenhum
-- endpoint admin/* pode ser testado com login de verdade sem isso.
--
-- Senha já com hash bcrypt (10 rounds, mesmo padrão de src/modules/auth/auth.service.ts
-- ::getSaltRounds() default), gerado com o mesmo pacote `bcrypt` que o app usa — não é
-- texto plano, mas registrado aqui em claro só porque é usuário de teste em dev.
--
--   email:    admin.teste@stockzy.local
--   senha:    TesteAdmin2026!
--   role:     admin (acesso master)
--
-- Idempotente (ON CONFLICT DO NOTHING por email).

INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Admin de Teste',
  'admin.teste@stockzy.local',
  '$2b$10$doX8Pk6w43uQZl3DftK0C.H8RgfQe/jv9gbKQ2raL8AKN2jfyi0UG',
  'admin',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;
