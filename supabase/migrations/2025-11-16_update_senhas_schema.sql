-- Atualização do schema da tabela public.senhas para remover dependência de fallbacks
-- Este script é idempotente e pode ser reaplicado com segurança

BEGIN;

-- 1) Garantir colunas necessárias com defaults seguros
ALTER TABLE public.senhas
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Backfill e default antes de NOT NULL
UPDATE public.senhas SET observacoes = '' WHERE observacoes IS NULL;
ALTER TABLE public.senhas
  ALTER COLUMN observacoes SET DEFAULT '';
ALTER TABLE public.senhas
  ALTER COLUMN observacoes SET NOT NULL;

ALTER TABLE public.senhas
  ADD COLUMN IF NOT EXISTS numero_apartamento text;

ALTER TABLE public.senhas
  ADD COLUMN IF NOT EXISTS guiche text,
  ADD COLUMN IF NOT EXISTS atendente text;

-- 2) Constraints de integridade para status e tipo
-- Evita valores fora do conjunto previsto sem forçar enum de sistema
ALTER TABLE public.senhas
  ADD CONSTRAINT IF NOT EXISTS senhas_status_check
  CHECK (status IN ('aguardando','chamando','atendida','cancelada'));

ALTER TABLE public.senhas
  ADD CONSTRAINT IF NOT EXISTS senhas_tipo_check
  CHECK (tipo IN ('normal','preferencial'));

-- 3) Índices para acelerar consultas mais comuns
CREATE INDEX IF NOT EXISTS idx_senhas_status ON public.senhas(status);
CREATE INDEX IF NOT EXISTS idx_senhas_tipo ON public.senhas(tipo);
CREATE INDEX IF NOT EXISTS idx_senhas_hora_retirada ON public.senhas(hora_retirada);
CREATE INDEX IF NOT EXISTS idx_senhas_hora_chamada ON public.senhas(hora_chamada);
CREATE INDEX IF NOT EXISTS idx_senhas_hora_atendimento ON public.senhas(hora_atendimento);

-- 4) Comentários para documentação
COMMENT ON COLUMN public.senhas.observacoes IS 'Observações livres: ex. Checkin:Express, Prioridade:Prioritario, etc';
COMMENT ON COLUMN public.senhas.numero_apartamento IS 'Número do apartamento quando aplicável';
COMMENT ON COLUMN public.senhas.guiche IS 'Guichê onde a senha está sendo chamada';
COMMENT ON COLUMN public.senhas.atendente IS 'Nome do atendente chamador';

COMMIT;