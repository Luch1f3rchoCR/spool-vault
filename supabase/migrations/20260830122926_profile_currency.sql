-- Perfil financiero y pagos multimoneda aditivos. Los montos historicos
-- originales permanecen en purchase_orders; el pago real se congela aparte.

create table public.user_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  base_currency text not null default 'CRC' check (base_currency ~ '^[A-Z]{3}$'),
  billing_name text check (billing_name is null or char_length(billing_name) <= 160),
  billing_tax_id text check (billing_tax_id is null or char_length(billing_tax_id) <= 80),
  billing_email text check (billing_email is null or char_length(billing_email) <= 254),
  billing_address text check (billing_address is null or char_length(billing_address) <= 500),
  membership_status text not null default 'early_access'
    check (membership_status in ('early_access', 'active', 'past_due', 'paused', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_payments (
  order_id uuid primary key references public.purchase_orders(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paid_amount numeric(14, 2) not null check (paid_amount >= 0),
  paid_currency text not null check (paid_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(18, 8) not null check (exchange_rate > 0),
  exchange_rate_date date not null,
  exchange_rate_kind text not null
    check (exchange_rate_kind in ('paid', 'historical', 'current', 'manual', 'estimated')),
  exchange_rate_source text
    check (exchange_rate_source is null or char_length(exchange_rate_source) <= 200),
  created_at timestamptz not null default now()
);

create index purchase_order_payments_user_id_idx
  on public.purchase_order_payments (user_id);

alter table public.user_profiles enable row level security;
alter table public.purchase_order_payments enable row level security;

create policy "Users can read their profile"
on public.user_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their profile"
on public.user_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their profile"
on public.user_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read their purchase payments"
on public.purchase_order_payments for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their purchase payments"
on public.purchase_order_payments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_payments.order_id
      and po.user_id = (select auth.uid())
  )
);

revoke all on table public.user_profiles from public, anon, authenticated;
revoke all on table public.purchase_order_payments from public, anon, authenticated;
grant select, insert, update on table public.user_profiles to authenticated;
grant select, insert on table public.purchase_order_payments to authenticated;
grant select, insert, update, delete on table public.user_profiles to service_role;
grant select, insert, update, delete on table public.purchase_order_payments to service_role;

create or replace function public.set_user_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_user_profile_updated_at();

create or replace function public.validate_purchase_order_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.purchase_orders;
begin
  select * into v_order
  from public.purchase_orders
  where id = new.order_id;

  if not found or v_order.user_id <> new.user_id then
    raise exception 'El pago no pertenece a la orden';
  end if;

  if new.paid_currency = v_order.currency and new.exchange_rate <> 1 then
    raise exception 'El tipo de cambio debe ser 1 cuando la moneda no cambia';
  end if;

  return new;
end;
$$;

create trigger purchase_order_payments_validate
before insert on public.purchase_order_payments
for each row execute function public.validate_purchase_order_payment();

create or replace function public.save_user_profile(
  p_display_name text,
  p_base_currency text,
  p_billing_name text,
  p_billing_tax_id text,
  p_billing_email text,
  p_billing_address text
)
returns public.user_profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_currency text := upper(btrim(p_base_currency));
  v_profile public.user_profiles;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda base debe usar un codigo de tres letras';
  end if;

  insert into public.user_profiles (
    user_id, display_name, base_currency, billing_name,
    billing_tax_id, billing_email, billing_address
  ) values (
    v_user_id,
    nullif(btrim(p_display_name), ''),
    v_currency,
    nullif(btrim(p_billing_name), ''),
    nullif(btrim(p_billing_tax_id), ''),
    nullif(btrim(p_billing_email), ''),
    nullif(btrim(p_billing_address), '')
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    base_currency = excluded.base_currency,
    billing_name = excluded.billing_name,
    billing_tax_id = excluded.billing_tax_id,
    billing_email = excluded.billing_email,
    billing_address = excluded.billing_address
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.create_purchase_order_v2(
  p_request_id uuid,
  p_purchase_ids uuid[],
  p_purchased_at date,
  p_shipping_amount numeric,
  p_other_charges_amount numeric,
  p_allocation_method text,
  p_cost_confidence text,
  p_notes text,
  p_manual_allocations jsonb,
  p_paid_amount numeric,
  p_paid_currency text,
  p_exchange_rate numeric,
  p_exchange_rate_date date,
  p_exchange_rate_kind text,
  p_exchange_rate_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
  v_order public.purchase_orders;
  v_payment public.purchase_order_payments;
  v_paid_currency text := upper(btrim(p_paid_currency));
  v_paid_amount numeric(14, 2) := round(p_paid_amount, 2);
  v_exchange_rate numeric(18, 8) := round(p_exchange_rate, 8);
  v_has_payment boolean := p_paid_amount is not null
    or p_paid_currency is not null
    or p_exchange_rate is not null
    or p_exchange_rate_date is not null
    or p_exchange_rate_kind is not null
    or p_exchange_rate_source is not null;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;

  if v_has_payment then
    if v_paid_amount is null or v_paid_amount < 0 then
      raise exception 'Indica el monto realmente pagado';
    end if;
    if v_paid_currency is null or v_paid_currency !~ '^[A-Z]{3}$' then
      raise exception 'La moneda pagada debe usar un codigo de tres letras';
    end if;
    if v_exchange_rate is null or v_exchange_rate <= 0 then
      raise exception 'Indica un tipo de cambio mayor que cero';
    end if;
    if p_exchange_rate_date is null then raise exception 'Indica la fecha del tipo de cambio'; end if;
    if p_exchange_rate_kind not in ('paid', 'historical', 'current', 'manual', 'estimated') then
      raise exception 'La clase del tipo de cambio no es valida';
    end if;
    if p_exchange_rate_source is not null and char_length(p_exchange_rate_source) > 200 then
      raise exception 'La fuente del tipo de cambio no puede superar 200 caracteres';
    end if;
  end if;

  v_result := public.create_purchase_order(
    p_request_id,
    p_purchase_ids,
    p_purchased_at,
    p_shipping_amount,
    p_other_charges_amount,
    p_allocation_method,
    p_cost_confidence,
    p_notes,
    p_manual_allocations
  );

  select * into v_order
  from public.purchase_orders
  where id = (v_result -> 'order' ->> 'id')::uuid
    and user_id = v_user_id;

  if not found then raise exception 'Orden de compra no encontrada'; end if;

  if not v_has_payment then
    return v_result || jsonb_build_object('payment', null);
  end if;

  if v_paid_currency = v_order.currency and v_exchange_rate <> 1 then
    raise exception 'El tipo de cambio debe ser 1 cuando la moneda no cambia';
  end if;

  insert into public.purchase_order_payments (
    order_id, user_id, paid_amount, paid_currency, exchange_rate,
    exchange_rate_date, exchange_rate_kind, exchange_rate_source
  ) values (
    v_order.id, v_user_id, v_paid_amount, v_paid_currency, v_exchange_rate,
    p_exchange_rate_date, p_exchange_rate_kind,
    nullif(btrim(p_exchange_rate_source), '')
  )
  on conflict (order_id) do nothing;

  select * into v_payment
  from public.purchase_order_payments
  where order_id = v_order.id and user_id = v_user_id;

  if v_payment.paid_amount <> v_paid_amount
    or v_payment.paid_currency <> v_paid_currency
    or v_payment.exchange_rate <> v_exchange_rate
    or v_payment.exchange_rate_date <> p_exchange_rate_date
    or v_payment.exchange_rate_kind <> p_exchange_rate_kind
    or v_payment.exchange_rate_source is distinct from nullif(btrim(p_exchange_rate_source), '') then
    raise exception 'La operacion ya existe con datos de pago diferentes';
  end if;

  return v_result || jsonb_build_object('payment', to_jsonb(v_payment));
end;
$$;

revoke execute on function public.set_user_profile_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_purchase_order_payment() from public, anon, authenticated;
revoke execute on function public.save_user_profile(text, text, text, text, text, text) from public, anon;
revoke execute on function public.create_purchase_order_v2(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb,
  numeric, text, numeric, date, text, text
) from public, anon;

grant execute on function public.save_user_profile(text, text, text, text, text, text)
  to authenticated;
grant execute on function public.create_purchase_order_v2(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb,
  numeric, text, numeric, date, text, text
) to authenticated;

comment on table public.user_profiles is
  'Preferencias personales y datos opcionales de facturacion; CRC es la moneda base inicial.';
comment on table public.purchase_order_payments is
  'Pago real y relacion cambiaria congelados aparte del monto original de la orden.';
comment on function public.create_purchase_order_v2(
  uuid, uuid[], date, numeric, numeric, text, text, text, jsonb,
  numeric, text, numeric, date, text, text
) is 'Crea la orden, sus partidas y el pago multimoneda opcional en una sola transaccion idempotente.';
