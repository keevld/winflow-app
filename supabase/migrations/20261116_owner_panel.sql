-- Panel del dueño (Winflow): datos de negocio que hasta ahora no existían.
-- Todo con RLS activo y sin policies: solo lo lee y escribe el servidor con service role,
-- después de comprobar que quien entra está en platform_admins. Las agencias no pueden ver ni tocar nada de esto.

-- Estado comercial de cada agencia (se lleva a mano hasta que haya cobro automático).
create table if not exists public.agency_accounts (
  client_id uuid primary key references public.clients(id) on delete cascade,
  is_demo boolean not null default false,            -- agencias de ejemplo: fuera de las cifras de negocio
  stage text not null default 'pilot' check (stage in ('pilot', 'paying', 'paused', 'churned')),
  plan text,
  monthly_price numeric(12, 2) check (monthly_price is null or monthly_price >= 0),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  pilot_started_at date,
  paying_since date,
  churned_at date,
  churn_reason text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.agency_accounts enable row level security;
revoke all on public.agency_accounts from anon, authenticated;

-- Costos fijos mensuales de operar Winflow (hosting, base de datos, correo, etc.).
create table if not exists public.platform_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_amount numeric(12, 2) not null check (monthly_amount >= 0),
  currency text not null default 'USD' check (currency in ('MXN', 'USD')),
  created_at timestamptz not null default now()
);
alter table public.platform_costs enable row level security;
revoke all on public.platform_costs from anon, authenticated;

-- Ajustes del panel del dueño (por ahora: tipo de cambio para sumar pesos y dólares).
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;

-- Seguimiento de las solicitudes de piloto que llegan por la landing.
alter table public.pilot_requests
  add column if not exists status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'discarded')),
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists owner_notes text;

-- Agencias que ya existen: todas entran como piloto desde su fecha de alta.
insert into public.agency_accounts (client_id, stage, pilot_started_at)
select id, 'pilot', created_at::date from public.clients
on conflict (client_id) do nothing;

-- Estudio Brújula es la agencia de ejemplo (demos y muestras): no cuenta como cliente.
update public.agency_accounts a set is_demo = true
from public.clients c
where c.id = a.client_id and c.company_name = 'Estudio Brújula';
