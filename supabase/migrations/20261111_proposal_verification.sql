-- Verificador automático de afirmaciones: reporte y estado por propuesta.
alter table public.proposals
  add column if not exists verification jsonb,
  add column if not exists verification_status text;
