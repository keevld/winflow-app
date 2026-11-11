-- Lista de espera del piloto (formulario público de la landing).
-- RLS activo y sin policies: solo escribe la ruta /api/public/pilot con service role.
create table if not exists public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agency_name text not null,
  contact_name text not null,
  email text not null,
  website text,
  team_size text,
  call_tool text,
  message text,
  source text
);
alter table public.pilot_requests enable row level security;
revoke all on public.pilot_requests from anon, authenticated;
create index if not exists pilot_requests_created_at_idx on public.pilot_requests (created_at desc);
