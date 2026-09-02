-- Ajustes productivos editables y copia inmutable de costos por corrida.

alter table public.user_profiles
  add column if not exists production_cost_currency text,
  add column if not exists electricity_price_per_kwh numeric(14, 4),
  add column if not exists printer_average_power_w numeric(10, 2),
  add column if not exists machine_cost_per_hour numeric(14, 4) not null default 0,
  add column if not exists labor_cost_per_hour numeric(14, 4) not null default 0;

update public.user_profiles
set production_cost_currency = base_currency
where production_cost_currency is null;

alter table public.user_profiles
  alter column production_cost_currency set default 'CRC',
  alter column production_cost_currency set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_production_cost_currency_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_production_cost_currency_check
      check (production_cost_currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_electricity_price_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_electricity_price_check
      check (electricity_price_per_kwh is null or electricity_price_per_kwh between 0 and 1000000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_printer_power_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_printer_power_check
      check (printer_average_power_w is null or printer_average_power_w between 0.01 and 100000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_machine_cost_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_machine_cost_check
      check (machine_cost_per_hour between 0 and 1000000000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_labor_cost_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_labor_cost_check
      check (labor_cost_per_hour between 0 and 1000000000);
  end if;
end $$;

create table if not exists public.production_run_costs (
  run_id uuid primary key references public.production_runs(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  actual_labor_minutes integer check (actual_labor_minutes is null or actual_labor_minutes between 0 and 100000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  electricity_price_per_kwh numeric(14, 4)
    check (electricity_price_per_kwh is null or electricity_price_per_kwh between 0 and 1000000),
  printer_average_power_w numeric(10, 2)
    check (printer_average_power_w is null or printer_average_power_w between 0.01 and 100000),
  machine_cost_per_hour numeric(14, 4) not null
    check (machine_cost_per_hour between 0 and 1000000000),
  labor_cost_per_hour numeric(14, 4) not null
    check (labor_cost_per_hour between 0 and 1000000000),
  electricity_cost_amount numeric(16, 4)
    check (electricity_cost_amount is null or electricity_cost_amount >= 0),
  machine_cost_amount numeric(16, 4)
    check (machine_cost_amount is null or machine_cost_amount >= 0),
  labor_cost_amount numeric(16, 4)
    check (labor_cost_amount is null or labor_cost_amount >= 0),
  failure_cost_amount numeric(16, 4) not null default 0
    check (failure_cost_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists production_run_costs_user_idx
  on public.production_run_costs (user_id);

alter table public.production_run_costs enable row level security;

drop policy if exists "Users can read their production run costs" on public.production_run_costs;
create policy "Users can read their production run costs"
on public.production_run_costs for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their production run costs" on public.production_run_costs;
create policy "Users can insert their production run costs"
on public.production_run_costs for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.production_runs r
    where r.id = production_run_costs.run_id
      and r.user_id = (select auth.uid())
  )
);

revoke all on table public.production_run_costs from public, anon, authenticated;
grant select, insert on table public.production_run_costs to authenticated;
grant select, insert, update, delete on table public.production_run_costs to service_role;

create or replace function public.save_user_profile_v2(
  p_display_name text,
  p_base_currency text,
  p_billing_name text,
  p_billing_tax_id text,
  p_billing_email text,
  p_billing_address text,
  p_production_cost_currency text,
  p_electricity_price_per_kwh numeric,
  p_printer_average_power_w numeric,
  p_machine_cost_per_hour numeric,
  p_labor_cost_per_hour numeric
)
returns public.user_profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_base_currency text := upper(btrim(p_base_currency));
  v_cost_currency text := upper(btrim(p_production_cost_currency));
  v_profile public.user_profiles;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if v_base_currency is null or v_base_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda base debe usar un codigo de tres letras';
  end if;
  if v_cost_currency is null or v_cost_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda de costos debe usar un codigo de tres letras';
  end if;
  if p_electricity_price_per_kwh is not null
    and (p_electricity_price_per_kwh < 0 or p_electricity_price_per_kwh > 1000000) then
    raise exception 'El precio de electricidad no es valido';
  end if;
  if p_printer_average_power_w is not null
    and (p_printer_average_power_w <= 0 or p_printer_average_power_w > 100000) then
    raise exception 'La potencia promedio no es valida';
  end if;
  if p_machine_cost_per_hour is null
    or p_machine_cost_per_hour < 0 or p_machine_cost_per_hour > 1000000000 then
    raise exception 'El costo de maquina no es valido';
  end if;
  if p_labor_cost_per_hour is null
    or p_labor_cost_per_hour < 0 or p_labor_cost_per_hour > 1000000000 then
    raise exception 'El costo de mano de obra no es valido';
  end if;

  insert into public.user_profiles (
    user_id, display_name, base_currency, billing_name,
    billing_tax_id, billing_email, billing_address,
    production_cost_currency, electricity_price_per_kwh,
    printer_average_power_w, machine_cost_per_hour, labor_cost_per_hour
  ) values (
    v_user_id,
    nullif(btrim(p_display_name), ''),
    v_base_currency,
    nullif(btrim(p_billing_name), ''),
    nullif(btrim(p_billing_tax_id), ''),
    nullif(btrim(p_billing_email), ''),
    nullif(btrim(p_billing_address), ''),
    v_cost_currency,
    p_electricity_price_per_kwh,
    p_printer_average_power_w,
    p_machine_cost_per_hour,
    p_labor_cost_per_hour
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    base_currency = excluded.base_currency,
    billing_name = excluded.billing_name,
    billing_tax_id = excluded.billing_tax_id,
    billing_email = excluded.billing_email,
    billing_address = excluded.billing_address,
    production_cost_currency = excluded.production_cost_currency,
    electricity_price_per_kwh = excluded.electricity_price_per_kwh,
    printer_average_power_w = excluded.printer_average_power_w,
    machine_cost_per_hour = excluded.machine_cost_per_hour,
    labor_cost_per_hour = excluded.labor_cost_per_hour
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.complete_production_run_v2(
  p_request_id uuid,
  p_project_id uuid,
  p_produced_at date,
  p_quantity integer,
  p_status text,
  p_actual_minutes integer,
  p_sale_amount numeric,
  p_sale_currency text,
  p_notes text,
  p_filaments jsonb,
  p_components jsonb,
  p_actual_labor_minutes integer,
  p_failure_cost_amount numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.user_profiles;
  v_result jsonb;
  v_cost public.production_run_costs;
  v_run_id uuid;
  v_currency text;
  v_electricity_rate numeric;
  v_power_w numeric;
  v_machine_rate numeric;
  v_labor_rate numeric;
  v_electricity_cost numeric;
  v_machine_cost numeric;
  v_labor_cost numeric;
  v_failure_cost numeric := round(coalesce(p_failure_cost_amount, 0), 4);
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_actual_labor_minutes is not null
    and (p_actual_labor_minutes < 0 or p_actual_labor_minutes > 100000) then
    raise exception 'El tiempo de mano de obra no es valido';
  end if;
  if v_failure_cost < 0 or v_failure_cost > 999999999999 then
    raise exception 'El costo de fallos no es valido';
  end if;

  select * into v_profile
  from public.user_profiles
  where user_id = v_user_id;

  v_currency := coalesce(v_profile.production_cost_currency, v_profile.base_currency, 'CRC');
  v_electricity_rate := v_profile.electricity_price_per_kwh;
  v_power_w := v_profile.printer_average_power_w;
  v_machine_rate := coalesce(v_profile.machine_cost_per_hour, 0);
  v_labor_rate := coalesce(v_profile.labor_cost_per_hour, 0);

  v_electricity_cost := case
    when p_actual_minutes is null or v_electricity_rate is null or v_power_w is null then null
    else round((p_actual_minutes::numeric / 60) * (v_power_w / 1000) * v_electricity_rate, 4)
  end;
  v_machine_cost := case
    when p_actual_minutes is null then null
    else round((p_actual_minutes::numeric / 60) * v_machine_rate, 4)
  end;
  v_labor_cost := case
    when p_actual_labor_minutes is null then null
    else round((p_actual_labor_minutes::numeric / 60) * v_labor_rate, 4)
  end;

  v_result := public.complete_production_run(
    p_request_id, p_project_id, p_produced_at, p_quantity, p_status,
    p_actual_minutes, p_sale_amount, p_sale_currency, p_notes,
    p_filaments, p_components
  );

  v_run_id := (v_result -> 'run' ->> 'id')::uuid;

  insert into public.production_run_costs (
    run_id, user_id, actual_labor_minutes, currency,
    electricity_price_per_kwh, printer_average_power_w,
    machine_cost_per_hour, labor_cost_per_hour,
    electricity_cost_amount, machine_cost_amount,
    labor_cost_amount, failure_cost_amount
  ) values (
    v_run_id, v_user_id, p_actual_labor_minutes, v_currency,
    v_electricity_rate, v_power_w,
    v_machine_rate, v_labor_rate,
    v_electricity_cost, v_machine_cost,
    v_labor_cost, v_failure_cost
  )
  on conflict (run_id) do nothing;

  select * into v_cost
  from public.production_run_costs
  where run_id = v_run_id and user_id = v_user_id;

  if not found then raise exception 'No se pudo recuperar el costo de produccion'; end if;
  if v_cost.actual_labor_minutes is distinct from p_actual_labor_minutes
    or v_cost.currency <> v_currency
    or v_cost.electricity_price_per_kwh is distinct from v_electricity_rate
    or v_cost.printer_average_power_w is distinct from v_power_w
    or v_cost.machine_cost_per_hour <> v_machine_rate
    or v_cost.labor_cost_per_hour <> v_labor_rate
    or v_cost.electricity_cost_amount is distinct from v_electricity_cost
    or v_cost.machine_cost_amount is distinct from v_machine_cost
    or v_cost.labor_cost_amount is distinct from v_labor_cost
    or v_cost.failure_cost_amount <> v_failure_cost then
    raise exception 'La operacion ya existe con costos diferentes';
  end if;

  return v_result || jsonb_build_object('costs', to_jsonb(v_cost));
end;
$$;

revoke execute on function public.save_user_profile_v2(
  text, text, text, text, text, text, text, numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.save_user_profile_v2(
  text, text, text, text, text, text, text, numeric, numeric, numeric, numeric
) to authenticated;

revoke execute on function public.complete_production_run_v2(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric
) from public, anon;
grant execute on function public.complete_production_run_v2(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric
) to authenticated;

comment on table public.production_run_costs is
  'Copia inmutable de tarifas y costos operativos utilizados al cerrar una corrida.';
comment on function public.complete_production_run_v2(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric
) is 'Cierra la corrida y congela electricidad, maquina, mano de obra y fallos en la misma transaccion idempotente.';
