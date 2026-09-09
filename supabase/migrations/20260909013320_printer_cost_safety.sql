-- Additive correction: keep the previously applied printer migration unchanged.
-- No historical production costs are recalculated.
alter table public.printers add column machine_cost_currency text;
update public.printers p
set machine_cost_currency = coalesce(
  (select coalesce(u.production_cost_currency, u.base_currency) from public.user_profiles u where u.user_id = p.user_id), 'CRC');
alter table public.printers
  alter column machine_cost_currency set default 'CRC',
  alter column machine_cost_currency set not null,
  add constraint printers_machine_currency_check check (machine_cost_currency ~ '^[A-Z]{3}$');

alter table public.production_run_costs add column request_payload jsonb;

-- Check both run and printer ownership; an FK alone does not enforce tenants.
drop policy "Users can insert their production run costs" on public.production_run_costs;
create policy "Users can insert their production run costs"
on public.production_run_costs for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.production_runs r
    where r.id = production_run_costs.run_id and r.user_id = (select auth.uid()))
  and (printer_id is null or exists (select 1 from public.printers p
    where p.id = production_run_costs.printer_id and p.user_id = (select auth.uid())))
);

-- Keep every request, not just the last one: a delayed old edit must not
-- overwrite a newer edit. This is internal retry metadata, not user history.
create table public.printer_save_requests (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  printer_id uuid not null references public.printers(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index printer_save_requests_printer_idx on public.printer_save_requests(printer_id);
alter table public.printer_save_requests enable row level security;
create policy "Read own printer requests" on public.printer_save_requests
for select to authenticated using (user_id = (select auth.uid()));
create policy "Insert own printer requests" on public.printer_save_requests
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.printers p where p.id = printer_save_requests.printer_id and p.user_id = (select auth.uid())
  )
);
revoke all on public.printer_save_requests from public, anon, authenticated;
grant select, insert on public.printer_save_requests to authenticated;
grant all on public.printer_save_requests to service_role;

create or replace function public.save_printer_v2(
  p_request_id uuid, p_printer_id uuid, p_name text,
  p_manufacturer text, p_model text, p_nozzle_diameter_mm numeric,
  p_location text, p_average_power_w numeric, p_machine_cost_per_hour numeric,
  p_notes text, p_is_active boolean, p_machine_cost_currency text
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_currency text := upper(btrim(p_machine_cost_currency));
  v_payload jsonb;
  v_request public.printer_save_requests;
  v_result jsonb;
  v_printer public.printers;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'La clave de operacion es requerida'; end if;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda de la tarifa no es valida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object(
    'printer_id', p_printer_id, 'name', btrim(p_name),
    'manufacturer', nullif(btrim(p_manufacturer), ''), 'model', nullif(btrim(p_model), ''),
    'nozzle', p_nozzle_diameter_mm, 'location', nullif(btrim(p_location), ''),
    'power', p_average_power_w, 'rate', p_machine_cost_per_hour,
    'notes', nullif(btrim(p_notes), ''), 'active', coalesce(p_is_active, true), 'currency', v_currency
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':printer-save:' || p_request_id::text, 0)
  );
  select * into v_request from public.printer_save_requests
    where user_id = v_user_id and request_id = p_request_id;
  if found then
    if v_request.payload <> v_payload then
      raise exception 'La operacion ya existe con datos diferentes' using errcode = '22023';
    end if;
    select * into strict v_printer from public.printers
      where id = v_request.printer_id and user_id = v_user_id;
    return jsonb_build_object('printer', to_jsonb(v_printer), 'replayed', true);
  end if;
  v_result := public.save_printer(
    p_request_id, p_printer_id, p_name, p_manufacturer, p_model,
    p_nozzle_diameter_mm, p_location, p_average_power_w, p_machine_cost_per_hour,
    p_notes, p_is_active
  );
  update public.printers set machine_cost_currency = v_currency
    where id = (v_result -> 'printer' ->> 'id')::uuid and user_id = v_user_id
    returning * into strict v_printer;
  insert into public.printer_save_requests(user_id, request_id, printer_id, payload)
    values (v_user_id, p_request_id, v_printer.id, v_payload);
  return jsonb_build_object('printer', to_jsonb(v_printer), 'replayed', false);
end;
$$;
revoke execute on function public.save_printer_v2(uuid, uuid, text, text, text, numeric, text, numeric, numeric, text, boolean, text) from public, anon;
grant execute on function public.save_printer_v2(uuid, uuid, text, text, text, numeric, text, numeric, numeric, text, boolean, text) to authenticated;

-- The existing consumption trigger owns the balance update. Removing the
-- second subtraction prevents one production run consuming twice.
create or replace function public.complete_production_run(
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
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.print_projects;
  v_run public.production_runs;
  v_roll public.filament_rolls;
  v_requirement public.project_filament_requirements;
  v_component public.project_components;
  v_entry record;
  v_usage record;
  v_item jsonb;
  v_grams numeric;
  v_component_quantity numeric;
  v_unit_cost_per_g numeric;
  v_cost_amount numeric;
  v_filament_line public.production_run_filaments;
  v_component_line public.production_run_components;
  v_log public.consumption_logs;
  v_filament_lines jsonb;
  v_component_lines jsonb;
  v_updated_rolls jsonb;
  v_logs jsonb;
  v_sale_currency text := upper(btrim(p_sale_currency));
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;
  if p_project_id is null then raise exception 'Proyecto requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':production-run:' || p_request_id::text, 0)
  );

  select * into v_run
  from public.production_runs
  where user_id = v_user_id and request_id = p_request_id;

  if found then
    if v_run.project_id is distinct from p_project_id then
      raise exception 'El identificador de operacion ya fue utilizado';
    end if;

    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at, f.id), '[]'::jsonb)
      into v_filament_lines
    from public.production_run_filaments f
    where f.run_id = v_run.id and f.user_id = v_user_id;

    select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
      into v_component_lines
    from public.production_run_components c
    where c.run_id = v_run.id and c.user_id = v_user_id;

    select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
      into v_updated_rolls
    from public.filament_rolls r
    where r.user_id = v_user_id
      and r.id in (
        select f.roll_id from public.production_run_filaments f
        where f.run_id = v_run.id and f.roll_id is not null
      );

    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at, l.id), '[]'::jsonb)
      into v_logs
    from public.consumption_logs l
    where l.user_id = v_user_id
      and l.notes = 'production-run:' || v_run.id::text;

    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'filaments', v_filament_lines,
      'components', v_component_lines,
      'rolls', v_updated_rolls,
      'logs', v_logs,
      'replayed', true
    );
  end if;

  select * into v_project
  from public.print_projects
  where id = p_project_id and user_id = v_user_id
  for share;

  if not found then raise exception 'Proyecto no encontrado'; end if;
  if p_produced_at is null then raise exception 'La fecha de produccion es requerida'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception 'La cantidad producida no es valida';
  end if;
  if p_status not in ('completed', 'partial', 'failed') then
    raise exception 'El resultado de la corrida no es valido';
  end if;
  if p_actual_minutes is not null and (p_actual_minutes < 0 or p_actual_minutes > 100000) then
    raise exception 'La duracion real no es valida';
  end if;
  if (p_sale_amount is null) <> (p_sale_currency is null) then
    raise exception 'Indica monto y moneda de venta juntos';
  end if;
  if p_sale_amount is not null and p_sale_amount < 0 then
    raise exception 'El monto de venta no puede ser negativo';
  end if;
  if p_sale_amount is not null and v_sale_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda de venta no es valida';
  end if;
  if jsonb_typeof(p_filaments) <> 'array' or jsonb_array_length(p_filaments) = 0 then
    raise exception 'Registra al menos un consumo de filamento';
  end if;
  if jsonb_array_length(p_filaments) > 32 then raise exception 'Demasiados consumos de filamento'; end if;
  if p_components is null then p_components := '[]'::jsonb; end if;
  if jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) > 64 then
    raise exception 'Los insumos consumidos no son validos';
  end if;

  -- Bloquea cada rollo una sola vez y en orden estable; tambien valida el saldo agregado.
  for v_usage in
    select
      (entry.value ->> 'roll_id')::uuid as roll_id,
      sum((entry.value ->> 'grams_used')::numeric) as grams_used
    from jsonb_array_elements(p_filaments) as entry(value)
    group by (entry.value ->> 'roll_id')::uuid
    order by (entry.value ->> 'roll_id')::uuid
  loop
    if v_usage.grams_used is null or v_usage.grams_used <= 0 then
      raise exception 'Los gramos consumidos deben ser mayores que cero';
    end if;

    select * into v_roll
    from public.filament_rolls
    where id = v_usage.roll_id and user_id = v_user_id
    for update;

    if not found then raise exception 'Uno de los rollos no existe o no pertenece al usuario'; end if;
    if v_usage.grams_used > v_roll.available_weight_g then
      raise exception 'El consumo de % supera los % g disponibles en %',
        v_usage.grams_used, v_roll.available_weight_g, v_roll.color_name;
    end if;
  end loop;

  insert into public.production_runs (
    user_id, request_id, project_id, project_name, produced_at,
    quantity, status, actual_minutes, sale_amount, sale_currency, notes
  ) values (
    v_user_id, p_request_id, v_project.id, v_project.name, p_produced_at,
    p_quantity, p_status, p_actual_minutes, p_sale_amount,
    case when p_sale_amount is null then null else v_sale_currency end,
    nullif(btrim(p_notes), '')
  )
  returning * into v_run;

  for v_entry in
    select value as item, ordinality
    from jsonb_array_elements(p_filaments) with ordinality
  loop
    v_item := v_entry.item;
    v_grams := nullif(v_item ->> 'grams_used', '')::numeric;

    select * into v_requirement
    from public.project_filament_requirements
    where id = (v_item ->> 'requirement_id')::uuid
      and project_id = v_project.id
      and user_id = v_user_id;

    if not found then raise exception 'Un requisito no pertenece al proyecto'; end if;

    select * into v_roll
    from public.filament_rolls
    where id = (v_item ->> 'roll_id')::uuid and user_id = v_user_id
    for update;

    if not found then raise exception 'Rollo no encontrado'; end if;

    v_unit_cost_per_g := case
      when v_roll.filament_cost_amount is null or v_roll.initial_weight_g <= 0 then null
      else round(v_roll.filament_cost_amount / v_roll.initial_weight_g, 6)
    end;
    v_cost_amount := case
      when v_unit_cost_per_g is null then null
      else round(v_unit_cost_per_g * v_grams, 4)
    end;

    insert into public.production_run_filaments (
      user_id, run_id, project_requirement_id, roll_id,
      brand, material, product_line, color_name, color_hex,
      grams_used, unit_cost_per_g, cost_amount, currency
    ) values (
      v_user_id, v_run.id, v_requirement.id, v_roll.id,
      v_roll.brand, v_roll.material, v_roll.product_line,
      v_roll.color_name, v_roll.color_hex, v_grams,
      v_unit_cost_per_g, v_cost_amount,
      case when v_cost_amount is null then null else v_roll.currency end
    )
    returning * into v_filament_line;

    insert into public.consumption_logs (
      user_id, roll_id, project_name, grams_used, consumed_at,
      notes, cost_amount, currency, request_id
    ) values (
      v_user_id, v_roll.id, v_project.name, v_grams, p_produced_at,
      'production-run:' || v_run.id::text, v_cost_amount,
      case when v_cost_amount is null then null else v_roll.currency end,
      gen_random_uuid()
    )
    returning * into v_log;

    -- consumption_logs INSERT already updates the balance via its trigger.
  end loop;

  for v_entry in
    select value as item, ordinality
    from jsonb_array_elements(p_components) with ordinality
  loop
    v_item := v_entry.item;
    v_component_quantity := nullif(v_item ->> 'quantity', '')::numeric;

    select * into v_component
    from public.project_components
    where id = (v_item ->> 'component_id')::uuid
      and project_id = v_project.id
      and user_id = v_user_id;

    if not found then raise exception 'Un insumo no pertenece al proyecto'; end if;
    if v_component_quantity is null or v_component_quantity <= 0 then
      raise exception 'La cantidad consumida del insumo debe ser mayor que cero';
    end if;

    insert into public.production_run_components (
      user_id, run_id, project_component_id, name, unit,
      quantity, unit_cost, cost_amount, currency, supplier_name
    ) values (
      v_user_id, v_run.id, v_component.id, v_component.name, v_component.unit,
      v_component_quantity, v_component.unit_cost,
      round(v_component_quantity * v_component.unit_cost, 4),
      v_component.currency, v_component.supplier_name
    )
    returning * into v_component_line;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at, f.id), '[]'::jsonb)
    into v_filament_lines
  from public.production_run_filaments f
  where f.run_id = v_run.id and f.user_id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
    into v_component_lines
  from public.production_run_components c
  where c.run_id = v_run.id and c.user_id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
    into v_updated_rolls
  from public.filament_rolls r
  where r.user_id = v_user_id
    and r.id in (
      select f.roll_id from public.production_run_filaments f
      where f.run_id = v_run.id and f.roll_id is not null
    );

  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at, l.id), '[]'::jsonb)
    into v_logs
  from public.consumption_logs l
  where l.user_id = v_user_id
    and l.notes = 'production-run:' || v_run.id::text;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'filaments', v_filament_lines,
    'components', v_component_lines,
    'rolls', v_updated_rolls,
    'logs', v_logs,
    'replayed', false
  );
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
  v_payload jsonb;
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

  v_payload := jsonb_build_object(
    'project_id', p_project_id, 'produced_at', p_produced_at, 'quantity', p_quantity,
    'status', p_status, 'actual_minutes', p_actual_minutes,
    'sale_amount', p_sale_amount, 'sale_currency', upper(btrim(p_sale_currency)),
    'notes', nullif(btrim(p_notes), ''), 'filaments', p_filaments, 'components', p_components,
    'actual_labor_minutes', p_actual_labor_minutes,
    'failure_cost_amount', v_failure_cost, 'printer_id', p_printer_id
  );

  v_result := public.complete_production_run(
    p_request_id, p_project_id, p_produced_at, p_quantity, p_status,
    p_actual_minutes, p_sale_amount, p_sale_currency, p_notes,
    p_filaments, p_components
  );

  v_run_id := (v_result -> 'run' ->> 'id')::uuid;

  -- The base function holds a per-user/request transaction lock. Recover the
  -- saved snapshot BEFORE consulting mutable printer/profile settings.
  select * into v_cost from public.production_run_costs
    where run_id = v_run_id and user_id = v_user_id;
  if found then
    if (v_cost.request_payload is not null and v_cost.request_payload <> v_payload)
      or v_cost.actual_labor_minutes is distinct from p_actual_labor_minutes
      or v_cost.failure_cost_amount <> v_failure_cost
      or v_cost.printer_id is distinct from p_printer_id then
      raise exception 'La operacion ya existe con datos diferentes' using errcode = '22023';
    end if;
    -- Legacy rows have no request_payload. Return their original snapshot;
    -- never infer historical rates from today's settings.
    return v_result || jsonb_build_object('costs', to_jsonb(v_cost));
  end if;
  if (v_result ->> 'replayed')::boolean then
    raise exception 'La corrida historica no tiene costos guardados; requiere revision';
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
    if not v_printer.is_active then raise exception 'La impresora esta inactiva'; end if;
  end if;

  v_currency := coalesce(v_profile.production_cost_currency, v_profile.base_currency, 'CRC');
  if v_printer.machine_cost_per_hour is not null
    and v_printer.machine_cost_currency is distinct from v_currency then
    raise exception 'La moneda de la tarifa de impresora no coincide con Perfil';
  end if;
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



  insert into public.production_run_costs (
    run_id, user_id, actual_labor_minutes, currency,
    electricity_price_per_kwh, printer_average_power_w,
    machine_cost_per_hour, labor_cost_per_hour,
    electricity_cost_amount, machine_cost_amount,
    labor_cost_amount, failure_cost_amount,
    printer_id, printer_name, printer_manufacturer, printer_model, request_payload
  ) values (
    v_run_id, v_user_id, p_actual_labor_minutes, v_currency,
    v_electricity_rate, v_power_w,
    v_machine_rate, v_labor_rate,
    v_electricity_cost, v_machine_cost,
    v_labor_cost, v_failure_cost,
    v_printer.id, v_printer.name, v_printer.manufacturer, v_printer.model, v_payload
  )
  on conflict (run_id) do nothing;

  select * into v_cost
  from public.production_run_costs
  where run_id = v_run_id and user_id = v_user_id;

  if not found then raise exception 'No se pudo recuperar el costo de produccion'; end if;

  return v_result || jsonb_build_object('costs', to_jsonb(v_cost));
end;
$$;
