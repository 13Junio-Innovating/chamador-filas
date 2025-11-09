-- Cria função RPC para obter o próximo número de senha por tipo
-- Assinatura esperada pelo frontend: get_proximo_numero_senha(tipo_senha text) retorna integer

create or replace function public.get_proximo_numero_senha(tipo_senha text)
returns integer
language sql
security definer
as $$
  select coalesce(max(s.numero), 0) + 1
  from public.senhas s
  where s.tipo = tipo_senha;
$$;

-- Permissões para chamadas via PostgREST
grant execute on function public.get_proximo_numero_senha(text) to anon, authenticated;