-- Impresoras configurables y snapshot de la maquina usada por corrida.

create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creation_request_id uuid not null,
  last_update_request_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 120),
  model text check (model is null or char_length(model) <= 120),
  nozzle_diameter_mm numeric(5, 2)
    check (nozzle_diameter_mm is null or nozzle_diameter_mm between 0.05 and 10),
  location text check (location is null or char_length(location) <= 160),
  average_power_w numeric(10, 2)
    check (average_power_w is null or average_power_w between 0.01 and 100000),
  machine_cost_per_hour numeric(14, 4)
    check (machine_cost_per_hour is null or machine_cost_per_hour between 0 and 1000000000),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, creation_request_id)
);

create index if not exists printers_user_active_name_idx
  on public.printers (user_id, is_active, name);

drop trigger if exists printers_set_updated_at on public.printers;
create trigger printers_set_updated_at
before update on public.printers
for each row execute function public.set_updated_at();

alter table public.printers enable row level security;

drop policy if exists "Users can read their printers" on public.printers;
create policy "Users can read their printers"
on public.printers for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their printers" on public.printers;
create policy "Users can insert their printers"
on public.printers for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their printers" on public.printers;
create policy "Users can update their printers"
on public.printers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.printers from public, anon, authenticated;
grant select, insert, update on table public.printers to authenticated;
grant select, insert, update, delete on table public.printers to service_role;

alter table public.production_run_costs
  add column if not exists printer_id uuid,
  add column if not exists printer_name text,
  add column if not exists printer_manufacturer text,
  add column if not exists printer_model text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'production_run_costs_printer_fkey'
      and conrelid = 'public.production_run_costs'::regclass
  ) then
    alter table public.production_run_costs
      add constraint production_run_costs_printer_fkey
      foreign key (printer_id) references public.printers(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'production_run_costs_printer_name_check'
      and conrelid = 'public.production_run_costs'::regclass
  ) then
    alter table public.production_run_costs
      add constraint production_run_costs_printer_name_check
      check (printer_name is null or char_length(printer_name) <= 120);
  end if;
end $$;

create index if not exists production_run_costs_printer_idx
  on public.production_run_costs (printer_id)
  where printer_id is not null;

create or replace function public.save_printer(
  p_request_id uuid,
  p_printer_id uuid,
  p_name text,
  p_manufacturer text,
  p_model text,
  p_nozzle_diameter_mm numeric,
  p_location text,
  p_average_power_w numeric,
  p_machine_cost_per_hour numeric,
  p_notes text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_printer public.printers;
  v_replayed boolean := false;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'La clave de operacion es requerida'; end if;
  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 120 then
    raise exception 'El nombre de la impresora no es valido';
  end if;
  if p_nozzle_diameter_mm is not null
    and (p_nozzle_diameter_mm < 0.05 or p_nozzle_diameter_mm > 10) then
    raise exception 'El diametro de boquilla no es valido';
  end if;
  if p_average_power_w is not null
    and (p_average_power_w <= 0 or p_average_power_w > 100000) then
    raise exception 'La potencia promedio no es valida';
  end if;
  if p_machine_cost_per_hour is not null
    and (p_machine_cost_per_hour < 0 or p_machine_cost_per_hour > 1000000000) then
    raise exception 'El costo de maquina no es valido';
  end if;

  if p_printer_id is null then
    insert into public.printers (
      user_id, creation_request_id, name, manufacturer, model,
      nozzle_diameter_mm, location, average_power_w,
      machine_cost_per_hour, notes, is_active
    ) values (
      v_user_id, p_request_id, btrim(p_name),
      nullif(btrim(p_manufacturer), ''), nullif(btrim(p_model), ''),
      p_nozzle_diameter_mm, nullif(btrim(p_location), ''), p_average_power_w,
      p_machine_cost_per_hour, nullif(btrim(p_notes), ''), coalesce(p_is_active, true)
    )
    on conflict (user_id, creation_request_id) do nothing
    returning * into v_printer;

    if not found then
      select * into v_printer
      from public.printers
      where user_id = v_user_id and creation_request_id = p_request_id;
      v_replayed := true;
    end if;
  else
    select * into v_printer
    from public.printers
    where id = p_printer_id and user_id = v_user_id
    for update;

    if not found then raise exception 'Impresora no encontrada'; end if;

    if v_printer.last_update_request_id = p_request_id then
      v_replayed := true;
    else
      update public.printers set
        last_update_request_id = p_request_id,
        name = btrim(p_name),
        manufacturer = nullif(btrim(p_manufacturer), ''),
        model = nullif(btrim(p_model), ''),
        nozzle_diameter_mm = p_nozzle_diameter_mm,
        location = nullif(btrim(p_location), ''),
        average_power_w = p_average_power_w,
        machine_cost_per_hour = p_machine_cost_per_hour,
        notes = nullif(btrim(p_notes), ''),
        is_active = coalesce(p_is_active, true)
      where id = p_printer_id and user_id = v_user_id
      returning * into v_printer;
    end if;
  end if;

  return jsonb_build_object('printer', to_jsonb(v_printer), 'replayed', v_replayed);
end;
$$;

create or replace function public.complete_production_run_v3(
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
  p_failure_cost_amount numeric,
  p_printer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.user_profiles;
  v_printer public.printers;
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

  if p_printer_id is not null then
    select * into v_printer
    from public.printers
    where id = p_printer_id and user_id = v_user_id
    for share;
    if not found then raise exception 'Impresora no encontrada'; end if;
  end if;

  v_currency := coalesce(v_profile.production_cost_currency, v_profile.base_currency, 'CRC');
  v_electricity_rate := v_profile.electricity_price_per_kwh;
  v_power_w := coalesce(v_printer.average_power_w, v_profile.printer_average_power_w);
  v_machine_rate := coalesce(v_printer.machine_cost_per_hour, v_profile.machine_cost_per_hour, 0);
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
    labor_cost_amount, failure_cost_amount,
    printer_id, printer_name, printer_manufacturer, printer_model
  ) values (
    v_run_id, v_user_id, p_actual_labor_minutes, v_currency,
    v_electricity_rate, v_power_w,
    v_machine_rate, v_labor_rate,
    v_electricity_cost, v_machine_cost,
    v_labor_cost, v_failure_cost,
    v_printer.id, v_printer.name, v_printer.manufacturer, v_printer.model
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
    or v_cost.failure_cost_amount <> v_failure_cost
    or v_cost.printer_id is distinct from v_printer.id
    or v_cost.printer_name is distinct from v_printer.name
    or v_cost.printer_manufacturer is distinct from v_printer.manufacturer
    or v_cost.printer_model is distinct from v_printer.model then
    raise exception 'La operacion ya existe con costos diferentes';
  end if;

  return v_result || jsonb_build_object('costs', to_jsonb(v_cost));
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
language sql
security invoker
set search_path = ''
as $$
  select public.complete_production_run_v3(
    p_request_id, p_project_id, p_produced_at, p_quantity, p_status,
    p_actual_minutes, p_sale_amount, p_sale_currency, p_notes,
    p_filaments, p_components, p_actual_labor_minutes,
    p_failure_cost_amount, null
  );
$$;

revoke execute on function public.save_printer(
  uuid, uuid, text, text, text, numeric, text, numeric, numeric, text, boolean
) from public, anon;
grant execute on function public.save_printer(
  uuid, uuid, text, text, text, numeric, text, numeric, numeric, text, boolean
) to authenticated;

revoke execute on function public.complete_production_run_v3(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric, uuid
) from public, anon;
grant execute on function public.complete_production_run_v3(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric, uuid
) to authenticated;

revoke execute on function public.complete_production_run_v2(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric
) from public, anon;
grant execute on function public.complete_production_run_v2(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric
) to authenticated;

comment on table public.printers is
  'Impresoras del usuario; se inactivan en lugar de eliminarse para conservar historia.';
comment on function public.complete_production_run_v3(
  uuid, uuid, date, integer, text, integer, numeric, text, text,
  jsonb, jsonb, integer, numeric, uuid
) is 'Cierra la corrida, descuenta inventario y congela la impresora y costos resueltos en una sola transaccion.';
