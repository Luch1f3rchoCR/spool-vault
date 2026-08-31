-- Completa una compra omitida sin reescribir historial ni permitir duplicados.

alter table public.purchase_history
  add column if not exists creation_request_id uuid;

create unique index if not exists purchase_history_user_creation_request_idx
  on public.purchase_history (user_id, creation_request_id)
  where creation_request_id is not null;

create or replace function public.register_missing_purchase(
  p_request_id uuid,
  p_roll_id uuid,
  p_supplier_name text,
  p_purchased_at date,
  p_package_type text,
  p_total_price numeric,
  p_spool_cost numeric,
  p_currency text
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
  v_filament_cost numeric;
  v_roll public.filament_rolls;
  v_supplier public.suppliers;
  v_purchase public.purchase_history;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;
  if p_roll_id is null then raise exception 'Filamento requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':missing-purchase:' || p_roll_id::text, 0)
  );

  select * into v_purchase
  from public.purchase_history
  where user_id = v_user_id and creation_request_id = p_request_id;

  if found then
    if v_purchase.roll_id is distinct from p_roll_id then
      raise exception 'El identificador de operacion ya fue utilizado';
    end if;

    select * into v_roll
    from public.filament_rolls
    where id = p_roll_id and user_id = v_user_id;

    select * into v_supplier
    from public.suppliers
    where id = v_purchase.supplier_id and user_id = v_user_id;

    return jsonb_build_object(
      'purchase', to_jsonb(v_purchase),
      'roll', to_jsonb(v_roll),
      'supplier', to_jsonb(v_supplier),
      'replayed', true
    );
  end if;

  select * into v_roll
  from public.filament_rolls
  where id = p_roll_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Filamento no encontrado'; end if;

  if exists (
    select 1 from public.purchase_history
    where roll_id = p_roll_id and user_id = v_user_id
  ) then
    raise exception 'Este filamento ya tiene una compra; usa Corregir compra';
  end if;

  if v_supplier_name is null then raise exception 'El proveedor es requerido'; end if;
  if p_purchased_at is null then raise exception 'La fecha de compra es requerida'; end if;
  if p_package_type not in ('spooled', 'refill') then
    raise exception 'La presentacion no es valida';
  end if;
  if p_total_price is null or p_total_price < 0 then
    raise exception 'El precio total no puede ser negativo';
  end if;
  if p_spool_cost is null or p_spool_cost < 0 or p_spool_cost > p_total_price then
    raise exception 'El costo del spool debe estar entre cero y el precio total';
  end if;
  if p_package_type = 'refill' and p_spool_cost <> 0 then
    raise exception 'Un refill no puede incluir costo de spool';
  end if;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda debe usar un codigo de tres letras';
  end if;

  v_filament_cost := p_total_price - p_spool_cost;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':supplier:' || lower(v_supplier_name), 0)
  );

  select * into v_supplier
  from public.suppliers
  where user_id = v_user_id
    and lower(btrim(name)) = lower(v_supplier_name)
  order by created_at
  limit 1;

  if not found then
    insert into public.suppliers (user_id, name)
    values (v_user_id, v_supplier_name)
    on conflict (user_id, name)
    do update set name = excluded.name
    returning * into v_supplier;
  end if;

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
    quantity_g,
    creation_request_id
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
    p_purchased_at,
    p_package_type,
    p_total_price,
    p_spool_cost,
    v_filament_cost,
    v_currency,
    v_roll.initial_weight_g,
    p_request_id
  )
  returning * into v_purchase;

  update public.filament_rolls
  set
    supplier_id = v_supplier.id,
    purchase_date = p_purchased_at,
    price_amount = p_total_price,
    currency = v_currency,
    package_type = p_package_type,
    spool_cost_amount = p_spool_cost,
    filament_cost_amount = v_filament_cost
  where id = v_roll.id and user_id = v_user_id
  returning * into v_roll;

  if not found then raise exception 'No se pudo actualizar el costo del filamento'; end if;

  return jsonb_build_object(
    'purchase', to_jsonb(v_purchase),
    'roll', to_jsonb(v_roll),
    'supplier', to_jsonb(v_supplier),
    'replayed', false
  );
end;
$$;

revoke execute on function public.register_missing_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text
) from public, anon;

grant execute on function public.register_missing_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text
) to authenticated;

comment on function public.register_missing_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text
) is 'Registra atomica e idempotentemente la compra omitida de un rollo que no tiene historial.';
