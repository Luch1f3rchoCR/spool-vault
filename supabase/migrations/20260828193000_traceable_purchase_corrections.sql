-- Correcciones de compra append-only: conserva el registro original y sincroniza
-- el costo vigente del rollo dentro de la misma transaccion.

create table if not exists public.purchase_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  purchase_id uuid not null references public.purchase_history(id) on delete restrict,
  roll_id uuid references public.filament_rolls(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null check (char_length(btrim(supplier_name)) > 0),
  purchased_at date not null,
  package_type text not null check (package_type in ('spooled', 'refill')),
  total_price numeric(10, 2) not null check (total_price >= 0),
  spool_cost numeric(10, 2) not null default 0 check (spool_cost >= 0),
  filament_cost numeric(10, 2) not null check (filament_cost >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  quantity_g numeric(8, 2) not null check (quantity_g > 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  corrected_at timestamptz not null default now(),
  check (spool_cost <= total_price),
  check (filament_cost = total_price - spool_cost),
  unique (user_id, request_id)
);

create index if not exists purchase_corrections_purchase_corrected_idx
  on public.purchase_corrections (purchase_id, corrected_at desc);

create index if not exists purchase_corrections_roll_id_idx
  on public.purchase_corrections (roll_id);

create index if not exists purchase_corrections_supplier_id_idx
  on public.purchase_corrections (supplier_id);

alter table public.purchase_corrections enable row level security;

drop policy if exists "Users can read their purchase corrections" on public.purchase_corrections;
create policy "Users can read their purchase corrections"
on public.purchase_corrections for select to authenticated
using ((select auth.uid()) = user_id);

-- La tabla es append-only y solo la funcion auditada agrega revisiones.
revoke all on table public.purchase_corrections from public, anon, authenticated;
grant select on table public.purchase_corrections to authenticated;
grant select, insert, update, delete on table public.purchase_corrections to service_role;

create or replace function public.correct_purchase(
  p_request_id uuid,
  p_purchase_id uuid,
  p_supplier_name text,
  p_purchased_at date,
  p_package_type text,
  p_total_price numeric,
  p_spool_cost numeric,
  p_currency text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_supplier_name text := nullif(btrim(p_supplier_name), '');
  v_currency text := upper(btrim(p_currency));
  v_filament_cost numeric;
  v_purchase public.purchase_history;
  v_correction public.purchase_corrections;
  v_supplier public.suppliers;
  v_roll public.filament_rolls;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;
  if p_purchase_id is null then raise exception 'Compra requerida'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':purchase-correction:' || p_purchase_id::text, 0)
  );

  select * into v_correction
  from public.purchase_corrections
  where user_id = v_user_id and request_id = p_request_id;

  if found then
    if v_correction.purchase_id <> p_purchase_id then
      raise exception 'El identificador de operacion ya fue utilizado';
    end if;

    if v_correction.roll_id is not null then
      select * into v_roll
      from public.filament_rolls
      where id = v_correction.roll_id and user_id = v_user_id;
    end if;

    return jsonb_build_object(
      'correction', to_jsonb(v_correction),
      'roll', case when v_roll.id is null then null else to_jsonb(v_roll) end,
      'replayed', true
    );
  end if;

  select * into v_purchase
  from public.purchase_history
  where id = p_purchase_id and user_id = v_user_id;

  if not found then raise exception 'Compra no encontrada'; end if;
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
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda debe usar un codigo de tres letras';
  end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'Indica brevemente el motivo de la correccion';
  end if;
  if char_length(btrim(p_reason)) > 500 then
    raise exception 'El motivo no puede superar 500 caracteres';
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

  insert into public.purchase_corrections (
    user_id,
    request_id,
    purchase_id,
    roll_id,
    supplier_id,
    supplier_name,
    purchased_at,
    package_type,
    total_price,
    spool_cost,
    filament_cost,
    currency,
    quantity_g,
    reason
  ) values (
    v_user_id,
    p_request_id,
    v_purchase.id,
    v_purchase.roll_id,
    v_supplier.id,
    v_supplier.name,
    p_purchased_at,
    p_package_type,
    p_total_price,
    p_spool_cost,
    v_filament_cost,
    v_currency,
    v_purchase.quantity_g,
    btrim(p_reason)
  )
  returning * into v_correction;

  if v_purchase.roll_id is not null then
    update public.filament_rolls
    set
      supplier_id = v_supplier.id,
      purchase_date = p_purchased_at,
      price_amount = p_total_price,
      currency = v_currency,
      package_type = p_package_type,
      spool_cost_amount = p_spool_cost,
      filament_cost_amount = v_filament_cost
    where id = v_purchase.roll_id and user_id = v_user_id
    returning * into v_roll;

    if not found then raise exception 'Filamento asociado no encontrado'; end if;
  end if;

  return jsonb_build_object(
    'correction', to_jsonb(v_correction),
    'roll', case when v_roll.id is null then null else to_jsonb(v_roll) end,
    'supplier', to_jsonb(v_supplier),
    'replayed', false
  );
end;
$$;

revoke execute on function public.correct_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text, text
) from public, anon;

grant execute on function public.correct_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text, text
) to authenticated;

comment on table public.purchase_corrections is
  'Revisiones inmutables de compras; el registro original permanece en purchase_history.';

comment on function public.correct_purchase(
  uuid, uuid, text, date, text, numeric, numeric, text, text
) is 'Agrega una correccion trazable y sincroniza el costo vigente del rollo atomicamente.';
