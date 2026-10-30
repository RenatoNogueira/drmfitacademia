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

-- Mensagens do formulário "Envie uma mensagem" (página Contato)
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text not null,
  plan        text,
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Depoimentos "Alunos que transformaram a rotina"
create table if not exists public.testimonials (
  id          bigint generated always as identity primary key,
  name        text not null,
  result      text,
  quote       text not null,
  photo_url   text,
  photo_path  text,
  position    integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Assinaturas de planos pagas por PIX (comprovante enviado pelo aluno e confirmado no painel)
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  protocol       text not null unique,
  plan           text not null,
  amount_cents   integer,
  name           text not null,
  phone          text not null,
  email          text,
  status         text not null default 'aguardando_pagamento'
                 check (status in ('aguardando_pagamento', 'em_analise', 'confirmado', 'recusado')),
  upload_token   text not null,
  receipt_path   text,
  receipt_type   text,
  receipt_at     timestamptz,
  reject_reason  text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- Impede dois alunos no mesmo horário (cancelados liberam o horário)
create unique index if not exists bookings_slot_unique
  on public.bookings (date, time) where status <> 'cancelado';

-- Segurança: só o servidor (chave service_role) acessa as tabelas.
alter table public.media    enable row level security;
alter table public.gallery  enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.testimonials enable row level security;
alter table public.subscriptions enable row level security;

-- Bucket público para as imagens enviadas pelo painel
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Bucket PRIVADO para os comprovantes de pagamento (só o servidor acessa)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Atualiza o cache do Supabase para enxergar as tabelas novas imediatamente
notify pgrst, 'reload schema';
