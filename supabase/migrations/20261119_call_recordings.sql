-- Captura de llamadas: un bot entra a la videollamada (Zoom / Meet / Teams), graba y transcribe.
-- La transcripción alimenta las notas de la propuesta. Apagado por defecto por agencia.

alter table public.clients
  add column if not exists calls_enabled boolean not null default false,
  add column if not exists calls_monthly_limit integer not null default 5;

create table if not exists public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('zoom','meet','teams')),
  meeting_url text,                       -- Recall lo borra a los pocos días; lo guardamos solo para soporte
  consent_confirmed boolean not null default false,
  status text not null default 'starting'
    check (status in ('starting','joining','waiting_room','recording','processing','ready','denied','failed','cancelled')),
  status_detail text,                     -- código técnico del proveedor (p. ej. sub_code)
  recall_bot_id text,
  recall_recording_id text,
  recall_transcript_id text,
  participants jsonb not null default '[]'::jsonb,   -- [{ key, name, is_host, words }]
  transcript jsonb,                                  -- [{ key, name, text, start }]
  duration_seconds integer,
  proposal_id uuid references public.proposals(id) on delete set null
);

create index if not exists call_recordings_client_idx on public.call_recordings (client_id, created_at desc);
create index if not exists call_recordings_bot_idx on public.call_recordings (recall_bot_id);
create index if not exists call_recordings_transcript_idx on public.call_recordings (recall_transcript_id);

alter table public.call_recordings enable row level security;

-- Lectura: el vendedor ve las suyas; el admin, las de su agencia. Escritura solo con service role (rutas del servidor).
create policy "call_recordings: seller select" on public.call_recordings
  for select using (auth.uid() = created_by);
create policy "call_recordings: admin select" on public.call_recordings
  for select using (public.requesting_user_is_admin_of(client_id));

revoke insert, update, delete on public.call_recordings from anon, authenticated;
revoke all on public.call_recordings from anon;
