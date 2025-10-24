-- Criar tipo enum para tipo de senha
CREATE TYPE senha_tipo AS ENUM ('normal', 'preferencial', 'proprietario', 'check-in', 'check-out');

-- Criar tipo enum para status de senha
CREATE TYPE senha_status AS ENUM ('aguardando', 'chamando', 'atendida', 'cancelada');

-- Criar tabela de senhas
CREATE TABLE public.senhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  tipo senha_tipo NOT NULL,
  status senha_status NOT NULL DEFAULT 'aguardando',
  hora_retirada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  hora_chamada TIMESTAMP WITH TIME ZONE,
  hora_atendimento TIMESTAMP WITH TIME ZONE,
  guiche TEXT,
  atendente TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX idx_senhas_status ON public.senhas(status);
CREATE INDEX idx_senhas_tipo ON public.senhas(tipo);
CREATE INDEX idx_senhas_hora_retirada ON public.senhas(hora_retirada DESC);

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para updated_at
CREATE TRIGGER update_senhas_updated_at
  BEFORE UPDATE ON public.senhas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.senhas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Permitir leitura pública (para o painel)
CREATE POLICY "Permitir leitura pública de senhas"
  ON public.senhas
  FOR SELECT
  USING (true);

-- Permitir inserção pública (para gerar senhas)
CREATE POLICY "Permitir inserção pública de senhas"
  ON public.senhas
  FOR INSERT
  WITH CHECK (true);

-- Permitir atualização apenas para usuários autenticados (equipe)
CREATE POLICY "Permitir atualização apenas para autenticados"
  ON public.senhas
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Criar função para obter próximo número de senha
CREATE OR REPLACE FUNCTION get_proximo_numero_senha(tipo_senha senha_tipo)
RETURNS INTEGER AS $$
DECLARE
  ultimo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero), 0) INTO ultimo_numero
  FROM public.senhas
  WHERE tipo = tipo_senha
    AND DATE(hora_retirada) = CURRENT_DATE;
  
  RETURN ultimo_numero + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar realtime para a tabela senhas
ALTER PUBLICATION supabase_realtime ADD TABLE public.senhas;