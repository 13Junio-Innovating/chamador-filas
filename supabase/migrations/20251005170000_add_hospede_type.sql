-- Adicionar novo tipo 'hospede' ao enum senha_tipo
SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'senha_tipo' AND e.enumlabel = 'hospede') THEN
    ALTER TYPE senha_tipo ADD VALUE 'hospede';
  END IF;
END$$;