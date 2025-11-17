-- Extensões necessárias (geração de UUID)
create extension if not exists pgcrypto;

-- Enums (inclui 'express' e estados adicionais usados no código)
do $$
begin
  if not exists(select 1 from pg_type where typname='senha_tipo') then
    create type senha_tipo as enum ('normal','preferencial','proprietario','check-in','check-out','express');
  end if;
end$$;

do $$
begin
  if not exists(select 1 from pg_type where typname='senha_status') then
    create type senha_status as enum ('aguardando','chamando','atendida','cancelada','atendendo','expirada');
  end if;
end$$;

-- Opcional: enum para futura expansão de check-in
do $$ begin
  if not exists(select 1 from pg_type where typname='tipo_checkin') then
    create type tipo_checkin as enum ('express','normal','proprietario');
  end if;
end $$;

-- Tabela principal 'senhas' (compatível com o app atual)
create table if not exists public.senhas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  tipo senha_tipo not null,
  status senha_status not null default 'aguardando',
  hora_retirada timestamptz not null default now(),
  hora_chamada timestamptz,
  hora_atendimento timestamptz,
  guiche text,
  atendente text,

  -- Campos adicionais usados em relatórios e possíveis evoluções (opcionais no app atual)
  usuario_id text,
  usuario_nome text,
  atendente_id text,
  atendente_nome text,
  prefixo text,
  senha_completa text,
  observacoes text,
  prioridade text,
  prioridade_nivel text,
  tipo_checkin tipo_checkin,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_senhas_status on public.senhas(status);
create index if not exists idx_senhas_tipo on public.senhas(tipo);
create index if not exists idx_senhas_hora_retirada on public.senhas(hora_retirada desc);

-- Função de trigger para updated_at
drop function if exists update_updated_at_column() cascade;
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists update_senhas_updated_at on public.senhas;
create trigger update_senhas_updated_at
  before update on public.senhas
  for each row
  execute function update_updated_at_column();

-- RPC: próximo número de senha por tipo (usado em Home.tsx)
drop function if exists get_proximo_numero_senha(senha_tipo);
create or replace function get_proximo_numero_senha(tipo_senha senha_tipo)
returns integer as $$
declare
  ultimo_numero integer;
begin
  select coalesce(max(numero),0) into ultimo_numero
  from public.senhas
  where tipo = tipo_senha
    and date(hora_retirada) = current_date;
  return ultimo_numero + 1;
end;
$$ language plpgsql security definer set search_path = public;

-- RLS e políticas (leitura pública para painel, inserção pública para gerar senhas,
-- atualização somente por autenticados para Admin/Atendente)
alter table public.senhas enable row level security;

drop policy if exists "Permitir leitura pública de senhas" on public.senhas;
create policy "Permitir leitura pública de senhas"
  on public.senhas for select
  using (true);

drop policy if exists "Permitir inserção pública de senhas" on public.senhas;
create policy "Permitir inserção pública de senhas"
  on public.senhas for insert
  with check (true);

drop policy if exists "Permitir atualização apenas para autenticados" on public.senhas;
create policy "Permitir atualização apenas para autenticados"
  on public.senhas for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Ativar realtime para a tabela senhas
alter publication supabase_realtime add table if not exists public.senhas;