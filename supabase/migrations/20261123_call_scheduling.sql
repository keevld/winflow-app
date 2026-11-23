-- Llamadas programadas: la agencia pega el enlace y la hora; el bot de Winflow entra solo a esa hora.
alter table public.call_recordings
  add column if not exists scheduled_for timestamptz;

alter table public.call_recordings drop constraint if exists call_recordings_status_check;
alter table public.call_recordings
  add constraint call_recordings_status_check
  check (status in ('scheduled','starting','joining','waiting_room','recording','processing','ready','denied','failed','cancelled'));

create index if not exists call_recordings_owner_idx on public.call_recordings (created_by, created_at desc);
