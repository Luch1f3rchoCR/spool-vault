-- Fase 0: escrituras críticas atómicas, reintentables y con privilegios mínimos.

alter table public.filament_rolls
  add column if not exists creation_request_id uuid;

alter table public.consumption_logs
  add column if not exists request_id uuid;

create unique index if not exists filament_rolls_user_creation_request_idx
  on public.filament_rolls (user_id, creation_request_id)
  where creation_request_id is not null;

create unique index if not exists consumption_logs_user_request_idx
  on public.consumption_logs (user_id, request_id)
  where request_id is not null;

create index if not exists consumption_logs_roll_id_idx
  on public.consumption_logs (roll_id);

create index if not exists filament_rolls_supplier_id_idx
  on public.filament_rolls (supplier_id);

create index if not exists purchase_history_roll_id_idx
  on public.purchase_history (roll_id);

create index if not exists purchase_history_supplier_id_idx
  on public.purchase_history (supplier_id);

create or replace function public.create_roll_with_purchase(
  p_request_id uuid,
  p_brand text,
  p_product_line text,
  p_material text,
  p_color_name text,
  p_color_hex text,
  p_initial_weight_g numeric,
  p_available_weight_g numeric,
  p_low_threshold_g numeric,
  p_location text,
  p_purchase_date date,
  p_total_price numeric,
  p_currency text,
  p_supplier_name text,
  p_package_type text,
  p_spool_cost numeric,
  p_drying_notes text,
  p_photo_url text,
  p_purchase_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_supplier_name text := nullif(btrim(p_supplier_name), '');
  v_currency text := upper(btrim(p_currency));
  v_status text;
  v_filament_cost numeric;
  v_roll public.filament_rolls;
  v_supplier public.suppliers;
  v_purchase public.purchase_history;
begin
  if v_user_id is null then
    raise exception 'Sesión requerida';
  end if;

  if p_request_id is null then
    raise exception 'Identificador de operación requerido';
  end if;

  -- Serializa únicamente reintentos de la misma operación.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_roll
  from public.filament_rolls
  where user_id = v_user_id
    and creation_request_id = p_request_id
  for update;

  if found then
    select *
    into v_supplier
    from public.suppliers
    where id = v_roll.supplier_id
      and user_id = v_user_id;

    select *
    into v_purchase
    from public.purchase_history
    where roll_id = v_roll.id
      and user_id = v_user_id
    order by created_at
    limit 1;

    return jsonb_build_object(
      'roll', to_jsonb(v_roll),
      'supplier', case when v_supplier.id is null then null else to_jsonb(v_supplier) end,
      'purchase', case when v_purchase.id is null then null else to_jsonb(v_purchase) end,
      'replayed', true
    );
  end if;

  if nullif(btrim(p_brand), '') is null
    or nullif(btrim(p_material), '') is null
    or nullif(btrim(p_color_name), '') is null then
    raise exception 'Marca, material y color son requeridos';
  end if;

  if p_color_hex is null or p_color_hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'El color HEX no es válido';
  end if;

  if p_initial_weight_g is null or p_initial_weight_g <= 0 then
    raise exception 'El peso inicial debe ser mayor que cero';
  end if;

  if p_available_weight_g is null
    or p_available_weight_g < 0
    or p_available_weight_g > p_initial_weight_g then
    raise exception 'El peso disponible debe estar entre cero y el peso inicial';
  end if;

  if p_low_threshold_g is null or p_low_threshold_g < 0 then
    raise exception 'El umbral bajo no puede ser negativo';
  end if;

  if p_package_type not in ('spooled', 'refill') then
    raise exception 'La presentación no es válida';
  end if;

  if v_currency is null or char_length(v_currency) <> 3 then
    raise exception 'La moneda debe usar un código de tres letras';
  end if;

  if p_spool_cost is null or p_spool_cost < 0 then
    raise exception 'El costo del spool no puede ser negativo';
  end if;

  if p_total_price is not null and (p_total_price < 0 or p_spool_cost > p_total_price) then
    raise exception 'El precio total debe cubrir el costo del spool';
  end if;

  v_supplier_name := coalesce(v_supplier_name, 'Sin proveedor');
  v_filament_cost := case
    when p_total_price is null then null
    else p_total_price - p_spool_cost
  end;
  v_status := case
    when p_available_weight_g <= 0 then 'empty'
    when p_available_weight_g <= p_low_threshold_g then 'low'
    when p_available_weight_g < p_initial_weight_g then 'open'
    else 'new'
  end;

  -- Evita crear variantes como "Pritonic" y "pritonic" sin reescribir las existentes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':supplier:' || lower(v_supplier_name), 0)
  );

  select *
  into v_supplier
  from public.suppliers
  where user_id = v_user_id
    and lower(btrim(name)) = lower(v_supplier_name)
  order by created_at
  limit 1
  for update;

  if not found then
    insert into public.suppliers (user_id, name)
    values (v_user_id, v_supplier_name)
    on conflict (user_id, name)
    do update set name = excluded.name
    returning * into v_supplier;
  end if;

  insert into public.filament_rolls (
    user_id,
    brand,
    product_line,
    material,
    color_name,
    color_hex,
    initial_weight_g,
    available_weight_g,
    low_threshold_g,
    status,
    location,
    purchase_date,
    price_amount,
    currency,
    supplier_id,
    package_type,
    spool_cost_amount,
    filament_cost_amount,
    drying_notes,
    photo_url,
    purchase_url,
    creation_request_id
  ) values (
    v_user_id,
    btrim(p_brand),
    nullif(btrim(p_product_line), ''),
    btrim(p_material),
    btrim(p_color_name),
    upper(p_color_hex),
    p_initial_weight_g,
    p_available_weight_g,
    p_low_threshold_g,
    v_status,
    nullif(btrim(p_location), ''),
    p_purchase_date,
    p_total_price,
    v_currency,
    v_supplier.id,
    p_package_type,
    p_spool_cost,
    v_filament_cost,
    nullif(btrim(p_drying_notes), ''),
    nullif(btrim(p_photo_url), ''),
    nullif(btrim(p_purchase_url), ''),
    p_request_id
  )
  returning * into v_roll;

  if p_total_price is not null then
    insert into public.purchase_history (
      user_id,
      roll_id,
      supplier_id,
      supplier_name,
      brand,
      material,
      product_line,
      color_name,
      color_hex,
      purchased_at,
      package_type,
      total_price,
      spool_cost,
      filament_cost,
      currency,
      quantity_g
    ) values (
      v_user_id,
      v_roll.id,
      v_supplier.id,
      v_supplier.name,
      v_roll.brand,
      v_roll.material,
      v_roll.product_line,
      v_roll.color_name,
      v_roll.color_hex,
      coalesce(p_purchase_date, current_date),
      v_roll.package_type,
      p_total_price,
      p_spool_cost,
      v_filament_cost,
      v_currency,
      p_initial_weight_g
    )
    returning * into v_purchase;
  end if;

  return jsonb_build_object(
    'roll', to_jsonb(v_roll),
    'supplier', to_jsonb(v_supplier),
    'purchase', case when v_purchase.id is null then null else to_jsonb(v_purchase) end,
    'replayed', false
  );
end;
$$;

create or replace function public.record_consumption(
  p_request_id uuid,
  p_roll_id uuid,
  p_project_name text,
  p_grams_used numeric,
  p_consumed_at date,
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
  v_log public.consumption_logs;
  v_cost_per_gram numeric;
begin
  if v_user_id is null then
    raise exception 'Sesión requerida';
  end if;

  if p_request_id is null then
    raise exception 'Identificador de operación requerido';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_log
  from public.consumption_logs
  where user_id = v_user_id
    and request_id = p_request_id;

  if found then
    select *
    into v_roll
    from public.filament_rolls
    where id = v_log.roll_id
      and user_id = v_user_id;

    return jsonb_build_object(
      'log', to_jsonb(v_log),
      'roll', to_jsonb(v_roll),
      'replayed', true
    );
  end if;

  select *
  into v_roll
  from public.filament_rolls
  where id = p_roll_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Filamento no encontrado';
  end if;

  if p_grams_used is null or p_grams_used <= 0 then
    raise exception 'El consumo debe ser mayor que cero';
  end if;

  if p_grams_used > v_roll.available_weight_g then
    raise exception 'El consumo supera los gramos disponibles';
  end if;

  if nullif(btrim(p_project_name), '') is null then
    raise exception 'El proyecto es requerido';
  end if;

  v_cost_per_gram := case
    when v_roll.filament_cost_amount is null or v_roll.initial_weight_g <= 0 then null
    else v_roll.filament_cost_amount / v_roll.initial_weight_g
  end;

  insert into public.consumption_logs (
    user_id,
    roll_id,
    project_name,
    grams_used,
    consumed_at,
    notes,
    cost_amount,
    currency,
    request_id
  ) values (
    v_user_id,
    v_roll.id,
    btrim(p_project_name),
    p_grams_used,
    coalesce(p_consumed_at, current_date),
    nullif(btrim(p_notes), ''),
    case when v_cost_per_gram is null then null else p_grams_used * v_cost_per_gram end,
    case when v_cost_per_gram is null then null else v_roll.currency end,
    p_request_id
  )
  returning * into v_log;

  select *
  into v_roll
  from public.filament_rolls
  where id = p_roll_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'log', to_jsonb(v_log),
    'roll', to_jsonb(v_roll),
    'replayed', false
  );
end;
$$;

-- Las funciones de API se exponen solo a sesiones autenticadas.
revoke execute on function public.create_roll_with_purchase(
  uuid, text, text, text, text, text, numeric, numeric, numeric, text,
  date, numeric, text, text, text, numeric, text, text, text
) from public, anon;
revoke execute on function public.record_consumption(
  uuid, uuid, text, numeric, date, text
) from public, anon;

grant execute on function public.create_roll_with_purchase(
  uuid, text, text, text, text, text, numeric, numeric, numeric, text,
  date, numeric, text, text, text, numeric, text, text, text
) to authenticated;
grant execute on function public.record_consumption(
  uuid, uuid, text, numeric, date, text
) to authenticated;

-- Funciones internas: siguen disponibles para triggers/event triggers, no como RPC.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_roll_after_consumption() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- El historial financiero se agrega, pero no se reescribe ni elimina desde el cliente.
drop policy if exists "Users can update their purchase history" on public.purchase_history;
drop policy if exists "Users can delete their purchase history" on public.purchase_history;
revoke update, delete on table public.purchase_history from authenticated;
