-- Corrigir search_path para as funções (com CASCADE)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
CREATE TRIGGER update_senhas_updated_at
  BEFORE UPDATE ON public.senhas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Corrigir segunda função
DROP FUNCTION IF EXISTS get_proximo_numero_senha(senha_tipo);
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;