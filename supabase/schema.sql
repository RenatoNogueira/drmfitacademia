-- DRMFIT: rode este arquivo uma vez no Supabase (SQL Editor → New query → Run).

-- Imagens dos espaços do site (hero, sobre, aulas, equipe...)
create table if not exists public.media (
  key         text primary key,
  url         text not null,
  path        text,
  updated_at  timestamptz not null default now()
);

-- Galeria "Vida na DRMFIT"
create table if not exists public.gallery (
  id          bigint generated always as identity primary key,
  url         text not null,
  path        text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Configurações (horários de avaliação em JSON)
create table if not exists public.settings (
  key    text primary key,
  value  jsonb not null
);

-- Agendamentos de avaliação
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  time        text not null,
  name        text not null,
  phone       text not null,
  email       text,
  objective   text,
  notes       text,
  status      text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado')),
  created_at  timestamptz not null default now()
);

-- Impede dois alunos no mesmo horário (cancelados liberam o horário)
create unique index if not exists bookings_slot_unique
  on public.bookings (date, time) where status <> 'cancelado';

-- Segurança: só o servidor (chave service_role) acessa as tabelas.
alter table public.media    enable row level security;
alter table public.gallery  enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;

-- Bucket público para as imagens enviadas pelo painel
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
