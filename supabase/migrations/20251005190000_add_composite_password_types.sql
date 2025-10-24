-- Adicionar nova estrutura de tipos compostos para senhas
SET search_path = public;

DO $$
BEGIN
  -- Adicionar coluna tipo_checkin se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'senhas' AND column_name = 'tipo_checkin') THEN
    ALTER TABLE senhas ADD COLUMN tipo_checkin TEXT CHECK (tipo_checkin IN ('proprietario', 'express', 'normal'));
  END IF;
  
  -- Adicionar coluna prioridade_nivel se não existir (renomeando a atual 'prioridade' para evitar conflitos)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'senhas' AND column_name = 'prioridade_nivel') THEN
    ALTER TABLE senhas ADD COLUMN prioridade_nivel TEXT CHECK (prioridade_nivel IN ('prioritario', 'comum'));
  END IF;
  
  -- Migrar dados existentes baseado no tipo atual
  UPDATE senhas SET 
    tipo_checkin = CASE 
      WHEN tipo = 'proprietario' THEN 'proprietario'
      WHEN tipo = 'express' THEN 'express'
      WHEN tipo = 'normal' THEN 'normal'
      WHEN tipo = 'preferencial' THEN 'normal'
      WHEN tipo = 'check-in' THEN 'express'
      WHEN tipo = 'check-out' THEN 'express'
      ELSE 'normal'
    END,
    prioridade_nivel = CASE 
      WHEN tipo IN ('preferencial', 'proprietario') THEN 'prioritario'
      WHEN prioridade = 'express' THEN 'prioritario'
      ELSE 'comum'
    END
  WHERE tipo_checkin IS NULL OR prioridade_nivel IS NULL;
  
  -- Tornar as colunas obrigatórias após a migração
  ALTER TABLE senhas ALTER COLUMN tipo_checkin SET NOT NULL;
  ALTER TABLE senhas ALTER COLUMN prioridade_nivel SET NOT NULL;
  
  -- Adicionar índices para melhor performance
  CREATE INDEX IF NOT EXISTS idx_senhas_tipo_checkin ON senhas(tipo_checkin);
  CREATE INDEX IF NOT EXISTS idx_senhas_prioridade_nivel ON senhas(prioridade_nivel);
  CREATE INDEX IF NOT EXISTS idx_senhas_composite_type ON senhas(tipo_checkin, prioridade_nivel);
END$$;