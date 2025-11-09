-- Adiciona coluna numero_apartamento em public.senhas
-- Mantém nulo para linhas existentes; sem impacto no Painel

ALTER TABLE public.senhas
ADD COLUMN IF NOT EXISTS numero_apartamento TEXT;

-- Opcional: índice se filtrar por apartamento futuramente
-- CREATE INDEX IF NOT EXISTS idx_senhas_numero_apartamento ON public.senhas (numero_apartamento);