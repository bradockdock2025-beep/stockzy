-- Achado testando o fluxo de compra ponta a ponta: geração de número de pedido
-- (OrdersService.generateOrderNumber) depende de uma SEQUENCE do Postgres
-- (orders_display_seq) que não é modelada no schema.prisma — é objeto de banco puro,
-- criado originalmente por prisma/migrations/20260603_orders_display_sequence/migration.sql
-- (migration antiga, anterior a esta reconstrução do catálogo). Por não ser um model
-- Prisma, `prisma migrate diff` (usado pra gerar SQL_FULL_SCHEMA.sql) NUNCA a capturou.
--
-- No seu banco real, ela muito provavelmente JÁ existe (é uma migration de 2026-06-03,
-- de antes desta sessão) — mas rode o SELECT abaixo pra confirmar antes de assumir.
-- Sem ela, TODO pedido (guest ou customer) falha na hora de criar (erro
-- "relation orders_display_seq does not exist").

-- 1. Confirma se já existe:
SELECT sequencename FROM pg_sequences WHERE sequencename = 'orders_display_seq';

-- 2. Se o SELECT acima não devolver nenhuma linha, roda isto (idempotente, seguro
--    mesmo se já existir):
CREATE SEQUENCE IF NOT EXISTS orders_display_seq
  START WITH 10000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
