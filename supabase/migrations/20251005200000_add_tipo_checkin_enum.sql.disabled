-- Adicionar enum tipo_checkin se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_checkin') THEN
    CREATE TYPE tipo_checkin AS ENUM ('proprietario', 'express', 'normal');
  END IF;
END$$;