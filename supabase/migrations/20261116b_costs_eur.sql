-- Costos fijos también en euros.
alter table public.platform_costs drop constraint if exists platform_costs_currency_check;
alter table public.platform_costs add constraint platform_costs_currency_check check (currency in ('MXN', 'USD', 'EUR'));
