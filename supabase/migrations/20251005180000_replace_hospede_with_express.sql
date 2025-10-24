-- Substituir tipo 'hospede' por 'express' no enum senha_tipo
SET search_path = public;

DO $$
BEGIN
  -- Primeiro, adicionar o novo valor 'express' se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'senha_tipo' AND e.enumlabel = 'express') THEN
    ALTER TYPE senha_tipo ADD VALUE 'express';
  END IF;
  
  -- Atualizar todos os registros existentes de 'hospede' para 'express'
  UPDATE senhas SET tipo = 'express' WHERE tipo = 'hospede';
  
  -- Remover o valor 'hospede' do enum (PostgreSQL não suporta remoção direta de valores de enum)
  -- Então vamos criar um novo enum e substituir
  CREATE TYPE senha_tipo_new AS ENUM ('normal', 'preferencial', 'proprietario', 'check-in', 'check-out', 'express');
  
  -- Alterar a coluna para usar o novo tipo
  ALTER TABLE senhas ALTER COLUMN tipo TYPE senha_tipo_new USING tipo::text::senha_tipo_new;
  
  -- Remover o enum antigo e renomear o novo
  DROP TYPE senha_tipo;
  ALTER TYPE senha_tipo_new RENAME TO senha_tipo;
END$$;