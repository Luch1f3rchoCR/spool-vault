-- Ordenes de compra aditivas: agrupan compras historicas sin reescribirlas y
-- congelan el prorrateo de envio y otros cargos por partida.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null check (char_length(btrim(supplier_name)) > 0),
  purchased_at date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_amount numeric(12, 2) not null check (subtotal_amount >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  other_charges_amount numeric(12, 2) not null default 0 check (other_charges_amount >= 0),
  total_amount numeric(12, 2) generated always as (
    subtotal_amount + shipping_amount + other_charges_amount
  ) stored,
  allocation_method text not null default 'per_unit'
    check (allocation_method in ('per_unit', 'by_value', 'manual')),
  cost_confidence text not null default 'actual'
    check (cost_confidence in ('actual', 'estimated', 'incomplete')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.purchase_orders(id) on delete restrict,
  purchase_history_id uuid not null unique references public.purchase_history(id) on delete restrict,
  roll_id uuid references public.filament_rolls(id) on delete set null,
  brand text not null,
  material text not null,
  product_line text,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  package_type text not null check (package_type in ('spooled', 'refill')),
  quantity_g numeric(8, 2) not null check (quantity_g > 0),
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  spool_cost numeric(12, 2) not null default 0 check (spool_cost >= 0),
  filament_base_cost numeric(12, 2) not null check (filament_base_cost >= 0),
  allocated_shipping numeric(12, 2) not null default 0 check (allocated_shipping >= 0),
  allocated_other_charges numeric(12, 2) not null default 0 check (allocated_other_charges >= 0),
  landed_total numeric(12, 2) generated always as (
    base_amount + allocated_shipping + allocated_other_charges
  ) stored,
  filament_landed_cost numeric(12, 2) generated always as (
    filament_base_cost + allocated_shipping + allocated_other_charges
  ) stored,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  cost_confidence text not null check (cost_confidence in ('actual', 'estimated', 'incomplete')),
  created_at timestamptz not null default now(),
  check (spool_cost <= base_amount),
  check (filament_base_cost = base_amount - spool_cost)
);

create index if not exists purchase_orders_user_purchased_idx
  on public.purchase_orders (user_id, purchased_at desc, created_at desc);

create index if not exists purchase_orders_supplier_id_idx
  on public.purchase_orders (supplier_id);

create index if not exists purchase_order_items_order_id_idx
  on public.purchase_order_items (order_id);

create index if not exists purchase_order_items_roll_id_idx
  on public.purchase_order_items (roll_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "Users can read their purchase orders" on public.purchase_orders;
create policy "Users can read their purchase orders"
on public.purchase_orders for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their purchase orders" on public.purchase_orders;
create policy "Users can insert their purchase orders"
on public.purchase_orders for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    supplier_id is null
    or exists (
      select 1 from public.suppliers s
      where s.id = purchase_orders.supplier_id
        and s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can read their purchase order items" on public.purchase_order_items;
create policy "Users can read their purchase order items"
on public.purchase_order_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their purchase order items" on public.purchase_order_items;
create policy "Users can insert their purchase order items"
on public.purchase_order_items for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_items.order_id
      and po.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.purchase_history ph
    where ph.id = purchase_order_items.purchase_history_id
      and ph.user_id = (select auth.uid())
      and ph.roll_id is not distinct from purchase_order_items.roll_id
  )
);

revoke all on table public.purchase_orders from public, anon, authenticated;
revoke all on table public.purchase_order_items from public, anon, authenticated;
grant select, insert on table public.purchase_orders to authenticated;
grant select, insert on table public.purchase_order_items to authenticated;
grant select, insert, update, delete on table public.purchase_orders to service_role;
grant select, insert, update, delete on table public.purchase_order_items to service_role;

create or replace function public.validate_purchase_order_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order public.purchase_orders;
  v_item_count integer;
  v_base numeric;
  v_shipping numeric;
  v_other numeric;
  v_all_owned boolean;
begin
  v_order_id := coalesce(
    nullif(to_jsonb(new) ->> 'order_id', '')::uuid,
    nullif(to_jsonb(new) ->> 'id', '')::uuid
  );

  select * into v_order
  from public.purchase_orders
  where id = v_order_id;

  if not found then
    raise exception 'Orden de compra no encontrada';
  end if;

  select
    count(*)::integer,
    coalesce(sum(i.base_amount), 0),
    coalesce(sum(i.allocated_shipping), 0),
    coalesce(sum(i.allocated_other_charges), 0),
    coalesce(bool_and(
      i.user_id = v_order.user_id
      and i.currency = v_order.currency
      and ph.user_id = v_order.user_id
      and ph.roll_id is not distinct from i.roll_id
    ), false)
  into v_item_count, v_base, v_shipping, v_other, v_all_owned
  from public.purchase_order_items i
  join public.purchase_history ph on ph.id = i.purchase_history_id
  where i.order_id = v_order.id;

  if v_item_count = 0 then
    raise exception 'La orden debe tener al menos una partida';
  end if;

  if not v_all_owned then
    raise exception 'Las partidas no pertenecen a la orden';
  end if;

  if v_base <> v_order.subtotal_amount
    or v_shipping <> v_order.shipping_amount
    or v_other <> v_order.other_charges_amount then
    raise exception 'El prorrateo de la orden no coincide con sus totales';
  end if;

  return null;
end;
$$;

drop trigger if exists purchase_orders_balance_check on public.purchase_orders;
create constraint trigger purchase_orders_balance_check
after insert on public.purchase_orders
deferrable initially deferred
for each row execute function public.validate_purchase_order_balance();

drop trigger if exists purchase_order_items_balance_check on public.purchase_order_items;
create constraint trigger purchase_order_items_balance_check
after insert on public.purchase_order_items
deferrable initially deferred
for each row execute function public.validate_purchase_order_balance();

create or replace function public.create_purchase_order(
  p_request_id uuid,
  p_purchase_ids uuid[],
  p_purchased_at date,
  p_shipping_amount numeric,
  p_other_charges_amount numeric,
  p_allocation_method text,
  p_cost_confidence text,
  p_notes text,
  p_manual_allocations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.purchase_orders;
  v_effective record;
  v_purchase_count integer;
  v_distinct_purchase_count integer;
  v_supplier_count integer;
  v_currency_count integer;
  v_supplier_id uuid;
  v_supplier_name text;
  v_currency text;
  v_subtotal numeric(12, 2);
  v_shipping numeric(12, 2) := round(coalesce(p_shipping_amount, 0), 2);
  v_other numeric(12, 2) := round(coalesce(p_other_charges_amount, 0), 2);
  v_position integer := 0;
  v_allocated_shipping numeric(12, 2);
  v_allocated_other numeric(12, 2);
  v_running_shipping numeric(12, 2) := 0;
  v_running_other numeric(12, 2) := 0;
  v_manual jsonb;
  v_items jsonb;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;
  if p_purchase_ids is null or cardinality(p_purchase_ids) = 0 then
    raise exception 'Selecciona al menos una compra';
  end if;
  if array_position(p_purchase_ids, null) is not null then
    raise exception 'La seleccion contiene una compra invalida';
  end if;
  if p_purchased_at is null then raise exception 'La fecha de la orden es requerida'; end if;
  if v_shipping < 0 or v_other < 0 then
    raise exception 'Los cargos de la orden no pueden ser negativos';
  end if;
  if p_allocation_method not in ('per_unit', 'by_value', 'manual') then
    raise exception 'El metodo de prorrateo no es valido';
  end if;
  if p_cost_confidence not in ('actual', 'estimated', 'incomplete') then
    raise exception 'La confianza del costo no es valida';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Las notas no pueden superar 1000 caracteres';
  end if;
  if p_allocation_method = 'manual'
    and (p_manual_allocations is null or jsonb_typeof(p_manual_allocations) <> 'object') then
    raise exception 'Indica el prorrateo manual de cada partida';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':purchase-order:' || p_request_id::text, 0)
  );

  select * into v_order
  from public.purchase_orders
  where user_id = v_user_id and request_id = p_request_id;

  if found then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.id), '[]'::jsonb)
    into v_items
    from public.purchase_order_items i
    where i.order_id = v_order.id and i.user_id = v_user_id;

    return jsonb_build_object(
      'order', to_jsonb(v_order),
      'items', v_items,
      'replayed', true
    );
  end if;

  select count(*), count(distinct purchase_id)
  into v_purchase_count, v_distinct_purchase_count
  from unnest(p_purchase_ids) as selected(purchase_id);

  if v_purchase_count <> v_distinct_purchase_count then
    raise exception 'Una compra no puede repetirse dentro de la orden';
  end if;

  -- Bloquea las compras en un orden estable sin requerir permiso UPDATE sobre
  -- el historial append-only.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':purchase-order-item:' || selected.purchase_id::text, 0)
  )
  from unnest(p_purchase_ids) as selected(purchase_id)
  order by selected.purchase_id;

  if (select count(*) from public.purchase_history ph
      where ph.id = any(p_purchase_ids) and ph.user_id = v_user_id) <> v_purchase_count then
    raise exception 'Una o mas compras no existen o no pertenecen al usuario';
  end if;

  if exists (
    select 1 from public.purchase_order_items i
    where i.purchase_history_id = any(p_purchase_ids)
  ) then
    raise exception 'Una de las compras ya pertenece a otra orden';
  end if;

  with effective as (
    select
      ph.id,
      coalesce(pc.supplier_id, ph.supplier_id) as supplier_id,
      btrim(coalesce(pc.supplier_name, ph.supplier_name)) as supplier_name,
      upper(coalesce(pc.currency, ph.currency)) as currency,
      coalesce(pc.total_price, ph.total_price) as total_price
    from public.purchase_history ph
    left join lateral (
      select correction.*
      from public.purchase_corrections correction
      where correction.purchase_id = ph.id and correction.user_id = v_user_id
      order by correction.corrected_at desc
      limit 1
    ) pc on true
    where ph.id = any(p_purchase_ids) and ph.user_id = v_user_id
  )
  select
    count(distinct lower(supplier_name)),
    count(distinct currency),
    (array_agg(supplier_id) filter (where supplier_id is not null))[1],
    min(supplier_name),
    min(currency),
    round(sum(total_price), 2)
  into v_supplier_count, v_currency_count, v_supplier_id, v_supplier_name, v_currency, v_subtotal
  from effective;

  if v_supplier_count <> 1 then
    raise exception 'Todas las partidas deben ser del mismo proveedor';
  end if;
  if v_currency_count <> 1 then
    raise exception 'No se pueden mezclar monedas dentro de una orden';
  end if;
  if p_allocation_method = 'by_value' and v_subtotal = 0 and (v_shipping > 0 or v_other > 0) then
    raise exception 'No se puede prorratear por valor cuando el subtotal es cero';
  end if;

  insert into public.purchase_orders (
    user_id, request_id, supplier_id, supplier_name, purchased_at, currency,
    subtotal_amount, shipping_amount, other_charges_amount, allocation_method,
    cost_confidence, notes
  ) values (
    v_user_id, p_request_id, v_supplier_id, v_supplier_name, p_purchased_at, v_currency,
    v_subtotal, v_shipping, v_other, p_allocation_method,
    p_cost_confidence, nullif(btrim(p_notes), '')
  ) returning * into v_order;

  for v_effective in
    select
      ph.id as purchase_id,
      ph.roll_id,
      ph.brand,
      ph.material,
      ph.product_line,
      ph.color_name,
      ph.color_hex,
      coalesce(pc.package_type, ph.package_type) as package_type,
      coalesce(pc.quantity_g, ph.quantity_g) as quantity_g,
      round(coalesce(pc.total_price, ph.total_price), 2) as total_price,
      round(coalesce(pc.spool_cost, ph.spool_cost), 2) as spool_cost,
      round(coalesce(pc.filament_cost, ph.filament_cost), 2) as filament_cost
    from public.purchase_history ph
    left join lateral (
      select correction.*
      from public.purchase_corrections correction
      where correction.purchase_id = ph.id and correction.user_id = v_user_id
      order by correction.corrected_at desc
      limit 1
    ) pc on true
    where ph.id = any(p_purchase_ids) and ph.user_id = v_user_id
    order by ph.id
  loop
    v_position := v_position + 1;

    if p_allocation_method = 'per_unit' then
      v_allocated_shipping := case
        when v_position = v_purchase_count then v_shipping - v_running_shipping
        else round(v_shipping / v_purchase_count, 2)
      end;
      v_allocated_other := case
        when v_position = v_purchase_count then v_other - v_running_other
        else round(v_other / v_purchase_count, 2)
      end;
    elsif p_allocation_method = 'by_value' then
      v_allocated_shipping := case
        when v_position = v_purchase_count then v_shipping - v_running_shipping
        when v_subtotal = 0 then 0
        else round(v_shipping * v_effective.total_price / v_subtotal, 2)
      end;
      v_allocated_other := case
        when v_position = v_purchase_count then v_other - v_running_other
        when v_subtotal = 0 then 0
        else round(v_other * v_effective.total_price / v_subtotal, 2)
      end;
    else
      v_manual := p_manual_allocations -> v_effective.purchase_id::text;
      if v_manual is null then
        raise exception 'Falta el prorrateo manual de una partida';
      end if;
      begin
        v_allocated_shipping := round(coalesce((v_manual ->> 'shipping')::numeric, 0), 2);
        v_allocated_other := round(coalesce((v_manual ->> 'other')::numeric, 0), 2);
      exception when invalid_text_representation then
        raise exception 'El prorrateo manual contiene un monto invalido';
      end;
    end if;

    if v_allocated_shipping < 0 or v_allocated_other < 0 then
      raise exception 'El prorrateo no puede contener montos negativos';
    end if;

    v_running_shipping := v_running_shipping + v_allocated_shipping;
    v_running_other := v_running_other + v_allocated_other;

    insert into public.purchase_order_items (
      user_id, order_id, purchase_history_id, roll_id,
      brand, material, product_line, color_name, color_hex, package_type, quantity_g,
      base_amount, spool_cost, filament_base_cost,
      allocated_shipping, allocated_other_charges, currency, cost_confidence
    ) values (
      v_user_id, v_order.id, v_effective.purchase_id, v_effective.roll_id,
      v_effective.brand, v_effective.material, v_effective.product_line,
      v_effective.color_name, v_effective.color_hex, v_effective.package_type,
      v_effective.quantity_g, v_effective.total_price, v_effective.spool_cost,
      v_effective.filament_cost, v_allocated_shipping, v_allocated_other,
      v_currency, p_cost_confidence
    );
  end loop;

  if v_running_shipping <> v_shipping or v_running_other <> v_other then
    raise exception 'El prorrateo manual debe coincidir con los cargos de la orden';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.id), '[]'::jsonb)
  into v_items
  from public.purchase_order_items i
  where i.order_id = v_order.id and i.user_id = v_user_id;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'items', v_items,
    'replayed', false
  );
end;
$$;

revoke execute on function public.validate_purchase_order_balance() from public, anon, authenticated;
revoke execute on function public.create_purchase_order(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb
) from public, anon;

grant execute on function public.create_purchase_order(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb
) to authenticated;

comment on table public.purchase_orders is
  'Encabezados inmutables de orden con cargos y confianza del costo.';

comment on table public.purchase_order_items is
  'Partidas inmutables que congelan el costo efectivo y el prorrateo aplicado.';

comment on function public.create_purchase_order(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb
) is 'Agrupa compras existentes y congela su prorrateo de cargos en una sola transaccion idempotente.';
