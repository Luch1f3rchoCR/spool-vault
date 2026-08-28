-- Catálogo reutilizable y pesajes históricos sin alterar inventario existente.

create table if not exists public.spool_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  manufacturer text not null,
  name text not null,
  material text not null,
  spool_weight_g numeric(8, 2) check (spool_weight_g is null or spool_weight_g >= 0),
  insert_weight_g numeric(8, 2) check (insert_weight_g is null or insert_weight_g >= 0),
  total_tare_g numeric(8, 2) not null check (total_tare_g >= 0),
  photo_url text,
  notes text,
  weight_source text,
  tare_confidence text not null default 'unknown'
    check (tare_confidence in ('verified', 'estimated', 'unknown')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists spool_types_global_name_idx
  on public.spool_types (lower(manufacturer), lower(name))
  where user_id is null;

create unique index if not exists spool_types_user_name_idx
  on public.spool_types (user_id, lower(manufacturer), lower(name))
  where user_id is not null;

create index if not exists spool_types_user_active_idx
  on public.spool_types (user_id, is_active, manufacturer, name);

alter table public.spools
  add column if not exists spool_type_id uuid references public.spool_types(id) on delete set null,
  add column if not exists creation_request_id uuid,
  add column if not exists last_update_request_id uuid;

create unique index if not exists spools_user_creation_request_idx
  on public.spools (user_id, creation_request_id)
  where creation_request_id is not null;

create unique index if not exists spools_user_last_update_request_idx
  on public.spools (user_id, last_update_request_id)
  where last_update_request_id is not null;

create index if not exists spools_spool_type_id_idx
  on public.spools (spool_type_id);

create table if not exists public.weighing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  roll_id uuid not null references public.filament_rolls(id) on delete cascade,
  spool_id uuid references public.spools(id) on delete set null,
  spool_type_id uuid references public.spool_types(id) on delete set null,
  measurement_kind text not null check (measurement_kind in ('scale', 'manual')),
  gross_weight_g numeric(8, 2) check (gross_weight_g is null or gross_weight_g >= 0),
  tare_weight_g numeric(8, 2) check (tare_weight_g is null or tare_weight_g >= 0),
  available_weight_g numeric(8, 2) not null check (available_weight_g >= 0),
  tare_confidence text not null default 'unknown'
    check (tare_confidence in ('verified', 'estimated', 'unknown')),
  weight_source text,
  notes text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check (
    measurement_kind = 'manual'
    or (
      gross_weight_g is not null
      and tare_weight_g is not null
      and abs((gross_weight_g - tare_weight_g) - available_weight_g) <= 0.01
    )
  )
);

create index if not exists weighing_events_user_roll_date_idx
  on public.weighing_events (user_id, roll_id, measured_at desc);

create index if not exists weighing_events_roll_id_idx
  on public.weighing_events (roll_id);

create index if not exists weighing_events_spool_id_idx
  on public.weighing_events (spool_id);

create index if not exists weighing_events_spool_type_id_idx
  on public.weighing_events (spool_type_id);

drop trigger if exists set_spool_types_updated_at on public.spool_types;
create trigger set_spool_types_updated_at
before update on public.spool_types
for each row execute function public.set_updated_at();

alter table public.spool_types enable row level security;
alter table public.weighing_events enable row level security;

drop policy if exists "Users can read available spool types" on public.spool_types;
create policy "Users can read available spool types"
on public.spool_types for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "Users can create their spool types" on public.spool_types;
create policy "Users can create their spool types"
on public.spool_types for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their spool types" on public.spool_types;
create policy "Users can update their spool types"
on public.spool_types for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their spool types" on public.spool_types;
create policy "Users can delete their spool types"
on public.spool_types for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their weighing events" on public.weighing_events;
create policy "Users can read their weighing events"
on public.weighing_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their weighing events" on public.weighing_events;
create policy "Users can insert their weighing events"
on public.weighing_events for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.filament_rolls r
    where r.id = weighing_events.roll_id
      and r.user_id = (select auth.uid())
  )
  and (
    spool_id is null
    or exists (
      select 1 from public.spools s
      where s.id = weighing_events.spool_id
        and s.user_id = (select auth.uid())
    )
  )
  and (
    spool_type_id is null
    or exists (
      select 1 from public.spool_types st
      where st.id = weighing_events.spool_type_id
        and (st.user_id is null or st.user_id = (select auth.uid()))
    )
  )
);

grant select, insert, update, delete on table public.spool_types to authenticated;
grant select, insert on table public.weighing_events to authenticated;
revoke all on table public.spool_types from anon;
revoke all on table public.weighing_events from anon;
revoke update, delete on table public.weighing_events from authenticated;

-- Referencias acordadas. Son catálogo global, no inventario físico.
insert into public.spool_types (
  user_id, manufacturer, name, material, spool_weight_g, insert_weight_g,
  total_tare_g, weight_source, tare_confidence, notes
)
select
  null,
  seed.manufacturer,
  seed.name,
  seed.material,
  seed.spool_weight_g,
  seed.insert_weight_g,
  seed.total_tare_g,
  seed.weight_source,
  seed.tare_confidence,
  seed.notes
from (
  values
    (
      'Bambu Lab'::text,
      'Reusable Spool'::text,
      'Plástico reutilizable'::text,
      213::numeric,
      41::numeric,
      254::numeric,
      'Medición física real'::text,
      'verified'::text,
      '213 g de spool + 41 g de cartón/RFID/NFC'::text
    ),
    (
      'Pritonic'::text,
      'Spool plástico'::text,
      'Plástico'::text,
      null::numeric,
      null::numeric,
      250::numeric,
      'Referencia provisional'::text,
      'estimated'::text,
      'Pendiente de medición física individual'::text
    ),
    (
      'Pritonic'::text,
      'Spool cartón'::text,
      'Cartón'::text,
      null::numeric,
      null::numeric,
      170::numeric,
      'Referencia provisional'::text,
      'estimated'::text,
      'Pendiente de medición física individual'::text
    )
) as seed(
  manufacturer, name, material, spool_weight_g, insert_weight_g,
  total_tare_g, weight_source, tare_confidence, notes
)
where not exists (
  select 1
  from public.spool_types existing
  where existing.user_id is null
    and lower(existing.manufacturer) = lower(seed.manufacturer)
    and lower(existing.name) = lower(seed.name)
);

create or replace function public.create_spool(
  p_request_id uuid,
  p_code text,
  p_spool_type_id uuid,
  p_brand text,
  p_spool_material text,
  p_tare_weight_g numeric,
  p_acquisition_cost numeric,
  p_currency text,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_spool public.spools;
  v_type public.spool_types;
  v_brand text;
  v_material text;
  v_tare numeric;
  v_currency text := upper(btrim(p_currency));
begin
  if v_user_id is null then raise exception 'Sesión requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operación requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':spool:' || p_request_id::text, 0)
  );

  select * into v_spool
  from public.spools
  where user_id = v_user_id and creation_request_id = p_request_id
  for update;

  if found then
    return jsonb_build_object('spool', to_jsonb(v_spool), 'replayed', true);
  end if;

  if nullif(btrim(p_code), '') is null then raise exception 'El código es requerido'; end if;
  if p_acquisition_cost is null or p_acquisition_cost < 0 then raise exception 'El costo no puede ser negativo'; end if;
  if v_currency is null or char_length(v_currency) <> 3 then raise exception 'La moneda debe usar tres letras'; end if;

  if p_spool_type_id is not null then
    select * into v_type
    from public.spool_types
    where id = p_spool_type_id
      and is_active
      and (user_id is null or user_id = v_user_id);
    if not found then raise exception 'Tipo de spool no disponible'; end if;
    v_brand := v_type.manufacturer;
    v_material := v_type.material;
    v_tare := v_type.total_tare_g;
  else
    v_brand := nullif(btrim(p_brand), '');
    v_material := coalesce(nullif(btrim(p_spool_material), ''), 'Otro');
    v_tare := p_tare_weight_g;
  end if;

  if v_tare is not null and v_tare < 0 then raise exception 'La tara no puede ser negativa'; end if;

  insert into public.spools (
    user_id, code, brand, spool_material, tare_weight_g, acquisition_cost,
    currency, status, notes, spool_type_id, creation_request_id
  ) values (
    v_user_id, btrim(p_code), v_brand, v_material, v_tare, p_acquisition_cost,
    v_currency, 'empty', nullif(btrim(p_notes), ''), p_spool_type_id, p_request_id
  )
  returning * into v_spool;

  return jsonb_build_object('spool', to_jsonb(v_spool), 'replayed', false);
end;
$$;

create or replace function public.update_spool(
  p_request_id uuid,
  p_spool_id uuid,
  p_code text,
  p_spool_type_id uuid,
  p_brand text,
  p_spool_material text,
  p_tare_weight_g numeric,
  p_acquisition_cost numeric,
  p_currency text,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_spool public.spools;
  v_type public.spool_types;
  v_brand text;
  v_material text;
  v_tare numeric;
  v_currency text := upper(btrim(p_currency));
begin
  if v_user_id is null then raise exception 'Sesión requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operación requerido'; end if;

  select * into v_spool
  from public.spools
  where id = p_spool_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Spool no encontrado'; end if;
  if v_spool.last_update_request_id = p_request_id then
    return jsonb_build_object('spool', to_jsonb(v_spool), 'replayed', true);
  end if;
  if nullif(btrim(p_code), '') is null then raise exception 'El código es requerido'; end if;
  if p_acquisition_cost is null or p_acquisition_cost < 0 then raise exception 'El costo no puede ser negativo'; end if;
  if v_currency is null or char_length(v_currency) <> 3 then raise exception 'La moneda debe usar tres letras'; end if;

  if p_spool_type_id is not null then
    select * into v_type
    from public.spool_types
    where id = p_spool_type_id
      and is_active
      and (user_id is null or user_id = v_user_id);
    if not found then raise exception 'Tipo de spool no disponible'; end if;
    v_brand := v_type.manufacturer;
    v_material := v_type.material;
    v_tare := v_type.total_tare_g;
  else
    v_brand := nullif(btrim(p_brand), '');
    v_material := coalesce(nullif(btrim(p_spool_material), ''), 'Otro');
    v_tare := p_tare_weight_g;
  end if;

  if v_tare is not null and v_tare < 0 then raise exception 'La tara no puede ser negativa'; end if;

  update public.spools
  set
    code = btrim(p_code),
    brand = v_brand,
    spool_material = v_material,
    tare_weight_g = v_tare,
    acquisition_cost = p_acquisition_cost,
    currency = v_currency,
    notes = nullif(btrim(p_notes), ''),
    spool_type_id = p_spool_type_id,
    last_update_request_id = p_request_id
  where id = p_spool_id
  returning * into v_spool;

  return jsonb_build_object('spool', to_jsonb(v_spool), 'replayed', false);
end;
$$;

create or replace function public.record_roll_weight(
  p_request_id uuid,
  p_roll_id uuid,
  p_measurement_kind text,
  p_gross_weight_g numeric,
  p_tare_weight_g numeric,
  p_available_weight_g numeric,
  p_spool_type_id uuid,
  p_tare_confidence text,
  p_weight_source text,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_roll public.filament_rolls;
  v_spool public.spools;
  v_type public.spool_types;
  v_event public.weighing_events;
  v_tare numeric := p_tare_weight_g;
  v_available numeric := p_available_weight_g;
  v_type_id uuid := p_spool_type_id;
  v_confidence text := coalesce(nullif(p_tare_confidence, ''), 'unknown');
  v_source text := nullif(btrim(p_weight_source), '');
  v_status text;
begin
  if v_user_id is null then raise exception 'Sesión requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operación requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':weight:' || p_request_id::text, 0)
  );

  select * into v_event
  from public.weighing_events
  where user_id = v_user_id and request_id = p_request_id;

  if found then
    select * into v_roll
    from public.filament_rolls
    where id = v_event.roll_id and user_id = v_user_id;
    return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event), 'replayed', true);
  end if;

  select * into v_roll
  from public.filament_rolls
  where id = p_roll_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Filamento no encontrado'; end if;

  if v_roll.spool_id is not null then
    select * into v_spool
    from public.spools
    where id = v_roll.spool_id and user_id = v_user_id;
    if v_type_id is null then v_type_id := v_spool.spool_type_id; end if;
  end if;

  if v_type_id is not null then
    select * into v_type
    from public.spool_types
    where id = v_type_id
      and is_active
      and (user_id is null or user_id = v_user_id);
    if not found then raise exception 'Tipo de spool no disponible'; end if;
    if v_tare is null then v_tare := v_type.total_tare_g; end if;
    if v_confidence = 'unknown' then v_confidence := v_type.tare_confidence; end if;
    if v_source is null then v_source := v_type.weight_source; end if;
  end if;

  if p_measurement_kind not in ('scale', 'manual') then raise exception 'Tipo de medición inválido'; end if;
  if v_confidence not in ('verified', 'estimated', 'unknown') then raise exception 'Confianza de tara inválida'; end if;
  if v_available is null or v_available < 0 or v_available > v_roll.initial_weight_g then
    raise exception 'El peso disponible debe estar entre cero y el peso inicial';
  end if;

  if p_measurement_kind = 'scale' then
    if p_gross_weight_g is null or p_gross_weight_g < 0 or v_tare is null or v_tare < 0 then
      raise exception 'Peso bruto y tara son requeridos';
    end if;
    v_available := round(p_gross_weight_g - v_tare, 2);
    if v_available < 0 or v_available > v_roll.initial_weight_g then
      raise exception 'El resultado del pesaje está fuera del rango del rollo';
    end if;
  end if;

  v_status := case
    when v_available <= 0 then 'empty'
    when v_available <= v_roll.low_threshold_g then 'low'
    when v_available < v_roll.initial_weight_g then 'open'
    else 'new'
  end;

  insert into public.weighing_events (
    user_id, request_id, roll_id, spool_id, spool_type_id, measurement_kind,
    gross_weight_g, tare_weight_g, available_weight_g, tare_confidence,
    weight_source, notes
  ) values (
    v_user_id, p_request_id, v_roll.id, v_roll.spool_id, v_type_id, p_measurement_kind,
    p_gross_weight_g, v_tare, v_available, v_confidence,
    v_source, nullif(btrim(p_notes), '')
  )
  returning * into v_event;

  update public.filament_rolls
  set available_weight_g = v_available, status = v_status
  where id = v_roll.id
  returning * into v_roll;

  return jsonb_build_object('roll', to_jsonb(v_roll), 'event', to_jsonb(v_event), 'replayed', false);
end;
$$;

revoke execute on function public.create_spool(
  uuid, text, uuid, text, text, numeric, numeric, text, text
) from public, anon;
revoke execute on function public.update_spool(
  uuid, uuid, text, uuid, text, text, numeric, numeric, text, text
) from public, anon;
revoke execute on function public.record_roll_weight(
  uuid, uuid, text, numeric, numeric, numeric, uuid, text, text, text
) from public, anon;

grant execute on function public.create_spool(
  uuid, text, uuid, text, text, numeric, numeric, text, text
) to authenticated;
grant execute on function public.update_spool(
  uuid, uuid, text, uuid, text, text, numeric, numeric, text, text
) to authenticated;
grant execute on function public.record_roll_weight(
  uuid, uuid, text, numeric, numeric, numeric, uuid, text, text, text
) to authenticated;
