-- FIN-01A: snapshots BCCR inmutables y valoración histórica de filamento.
create table public.historical_fx_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  acquisition_date date not null,
  source text not null default 'BCCR' check (source = 'BCCR'),
  source_currency text not null check (source_currency in ('CRC', 'USD', 'EUR')),
  crc_per_usd numeric(28, 12) not null check (crc_per_usd > 0),
  usd_per_eur numeric(28, 12) check (usd_per_eur is null or usd_per_eur > 0),
  source_to_crc_rate numeric(38, 18) not null check (source_to_crc_rate > 0),
  source_to_usd_rate numeric(38, 18) not null check (source_to_usd_rate > 0),
  indicator_318 integer not null default 318 check (indicator_318 = 318),
  indicator_318_effective_date date not null,
  indicator_318_raw_value numeric(28, 12) not null check (indicator_318_raw_value > 0),
  indicator_333 integer check (indicator_333 is null or indicator_333 = 333),
  indicator_333_effective_date date,
  indicator_333_raw_value numeric(28, 12) check (indicator_333_raw_value is null or indicator_333_raw_value > 0),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (user_id, acquisition_date, source_currency),
  check (indicator_318_effective_date = acquisition_date),
  check (
    (source_currency = 'EUR' and usd_per_eur is not null and indicator_333 = 333
      and indicator_333_effective_date = acquisition_date and indicator_333_raw_value is not null)
    or
    (source_currency in ('CRC', 'USD') and usd_per_eur is null and indicator_333 is null
      and indicator_333_effective_date is null and indicator_333_raw_value is null)
  )
);

create index historical_fx_snapshots_user_date_idx
  on public.historical_fx_snapshots (user_id, acquisition_date, source_currency);

alter table public.historical_fx_snapshots enable row level security;
create policy historical_fx_snapshots_read
on public.historical_fx_snapshots for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.historical_fx_snapshots from public, anon, authenticated;
grant select on table public.historical_fx_snapshots to authenticated;
grant select, insert on table public.historical_fx_snapshots to service_role;

create function public.record_bccr_fx_snapshot(
  p_user_id uuid,
  p_request_id uuid,
  p_acquisition_date date,
  p_source_currency text,
  p_indicator_318_effective_date date,
  p_indicator_318_raw_value numeric,
  p_indicator_333_effective_date date,
  p_indicator_333_raw_value numeric
)
returns public.historical_fx_snapshots
language plpgsql security invoker set search_path = '' as $$
declare
  v_currency text := upper(btrim(p_source_currency));
  v_existing public.historical_fx_snapshots;
  v_crc_per_usd numeric(28, 12);
  v_usd_per_eur numeric(28, 12);
  v_to_crc numeric(38, 18);
  v_to_usd numeric(38, 18);
begin
  if p_user_id is null then raise exception 'Usuario inválido'; end if;
  if p_request_id is null or p_acquisition_date is null then raise exception 'Solicitud y fecha requeridas'; end if;
  if v_currency not in ('CRC', 'USD', 'EUR') then raise exception 'Moneda no soportada'; end if;
  if p_indicator_318_effective_date is distinct from p_acquisition_date
    or p_indicator_318_raw_value is null or p_indicator_318_raw_value <= 0 then
    raise exception 'Indicador 318 inválido para la fecha de adquisición';
  end if;
  if v_currency = 'EUR' and (p_indicator_333_effective_date is distinct from p_acquisition_date
    or p_indicator_333_raw_value is null or p_indicator_333_raw_value <= 0) then
    raise exception 'Indicador 333 inválido para la fecha de adquisición';
  end if;
  if v_currency <> 'EUR' and (p_indicator_333_effective_date is not null or p_indicator_333_raw_value is not null) then
    raise exception 'El indicador 333 solo corresponde a EUR';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':bccr-fx:' || p_acquisition_date::text || ':' || v_currency, 0)
  );

  select * into v_existing from public.historical_fx_snapshots
  where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_existing.acquisition_date <> p_acquisition_date or v_existing.source_currency <> v_currency
      or v_existing.indicator_318_effective_date <> p_indicator_318_effective_date
      or v_existing.indicator_318_raw_value <> p_indicator_318_raw_value
      or v_existing.indicator_333_effective_date is distinct from p_indicator_333_effective_date
      or v_existing.indicator_333_raw_value is distinct from p_indicator_333_raw_value then
      raise exception 'La operación ya existe con datos diferentes';
    end if;
    return v_existing;
  end if;

  select * into v_existing from public.historical_fx_snapshots
  where user_id = p_user_id and acquisition_date = p_acquisition_date and source_currency = v_currency;
  if found then return v_existing; end if;

  v_crc_per_usd := round(p_indicator_318_raw_value, 12);
  v_usd_per_eur := case when v_currency = 'EUR' then round(p_indicator_333_raw_value, 12) else null end;
  v_to_crc := case v_currency when 'CRC' then 1 when 'USD' then v_crc_per_usd else v_usd_per_eur * v_crc_per_usd end;
  v_to_usd := case v_currency when 'CRC' then 1 / v_crc_per_usd when 'USD' then 1 else v_usd_per_eur end;

  insert into public.historical_fx_snapshots (
    user_id, request_id, acquisition_date, source_currency, crc_per_usd, usd_per_eur,
    source_to_crc_rate, source_to_usd_rate, indicator_318_effective_date,
    indicator_318_raw_value, indicator_333, indicator_333_effective_date, indicator_333_raw_value
  ) values (
    p_user_id, p_request_id, p_acquisition_date, v_currency, v_crc_per_usd, v_usd_per_eur,
    v_to_crc, v_to_usd, p_indicator_318_effective_date, p_indicator_318_raw_value,
    case when v_currency = 'EUR' then 333 else null end,
    p_indicator_333_effective_date, p_indicator_333_raw_value
  ) returning * into v_existing;
  return v_existing;
end;
$$;

revoke all on function public.record_bccr_fx_snapshot(uuid, uuid, date, text, date, numeric, date, numeric) from public, anon, authenticated;
grant execute on function public.record_bccr_fx_snapshot(uuid, uuid, date, text, date, numeric, date, numeric) to service_role;

create view public.filament_inventory_valuation
with (security_invoker = true) as
with roll_basis as (
  select
    r.id as roll_id,
    r.user_id,
    r.status,
    r.initial_weight_g,
    r.available_weight_g,
    linked.purchase_history_id,
    linked.order_id,
    case
      when linked.order_item_id is null then r.filament_cost_amount
      when r.purchase_date = linked.order_date and r.currency = linked.item_currency
        and r.filament_cost_amount is not distinct from linked.filament_base_cost then linked.filament_landed_cost
      else null
    end as historical_consumable_cost,
    case
      when linked.order_item_id is not null and (r.purchase_date is distinct from linked.order_date
        or r.currency is distinct from linked.item_currency
        or r.filament_cost_amount is distinct from linked.filament_base_cost) then r.currency
      when linked.order_item_id is not null then linked.item_currency
      else r.currency
    end as original_currency,
    case
      when linked.order_item_id is not null and (r.purchase_date is distinct from linked.order_date
        or r.currency is distinct from linked.item_currency
        or r.filament_cost_amount is distinct from linked.filament_base_cost) then r.purchase_date
      when linked.order_item_id is not null then linked.order_date
      else r.purchase_date
    end as acquisition_date,
    case
      when linked.order_item_id is not null and (r.purchase_date is distinct from linked.order_date
        or r.currency is distinct from linked.item_currency
        or r.filament_cost_amount is distinct from linked.filament_base_cost) then 'corrected_order_mismatch'
      when linked.order_item_id is not null then 'purchase_order_landed'
      else 'legacy_filament_cost'
    end as cost_basis_source,
    linked.order_item_id is not null and (r.purchase_date is distinct from linked.order_date
      or r.currency is distinct from linked.item_currency
      or r.filament_cost_amount is distinct from linked.filament_base_cost) as corrected_order_mismatch,
    linked.cost_confidence
  from public.filament_rolls r
  left join lateral (
    select
      ph.id as purchase_history_id,
      poi.id as order_item_id,
      poi.order_id,
      poi.filament_base_cost,
      poi.filament_landed_cost,
      poi.currency as item_currency,
      poi.cost_confidence,
      po.purchased_at as order_date
    from public.purchase_history ph
    left join public.purchase_order_items poi
      on poi.purchase_history_id = ph.id and poi.user_id = ph.user_id
    left join public.purchase_orders po
      on po.id = poi.order_id and po.user_id = poi.user_id
    where ph.roll_id = r.id and ph.user_id = r.user_id
    order by (poi.id is not null) desc, ph.created_at desc, ph.id desc
    limit 1
  ) linked on true
), valued as (
  select
    b.*,
    fx.id as fx_snapshot_id,
    fx.source as fx_source,
    fx.source_to_crc_rate,
    fx.source_to_usd_rate,
    fx.indicator_318,
    fx.indicator_318_effective_date,
    fx.indicator_318_raw_value,
    fx.indicator_333,
    fx.indicator_333_effective_date,
    fx.indicator_333_raw_value,
    case
      when b.status = 'archived' or b.available_weight_g = 0 or b.status = 'empty' then 0::numeric
      when b.historical_consumable_cost is null or b.initial_weight_g <= 0 then null::numeric
      else b.available_weight_g / b.initial_weight_g * b.historical_consumable_cost
    end as remaining_original_value
  from roll_basis b
  left join public.historical_fx_snapshots fx
    on fx.user_id = b.user_id
   and fx.acquisition_date = b.acquisition_date
   and fx.source_currency = b.original_currency
)
select
  v.roll_id,
  v.user_id,
  v.purchase_history_id,
  v.order_id,
  v.status,
  v.initial_weight_g,
  v.available_weight_g,
  v.acquisition_date,
  v.original_currency,
  v.historical_consumable_cost,
  v.cost_basis_source,
  v.cost_confidence,
  v.remaining_original_value,
  case
    when v.status = 'archived' or v.available_weight_g = 0 or v.status = 'empty' then 0::numeric
    when v.remaining_original_value is null then null::numeric
    when v.original_currency = 'CRC' then v.remaining_original_value
    when v.fx_snapshot_id is not null then v.remaining_original_value * v.source_to_crc_rate
    else null::numeric
  end as remaining_crc_value,
  case
    when v.status = 'archived' or v.available_weight_g = 0 or v.status = 'empty' then 0::numeric
    when v.remaining_original_value is null then null::numeric
    when v.original_currency = 'USD' then v.remaining_original_value
    when v.fx_snapshot_id is not null then v.remaining_original_value * v.source_to_usd_rate
    else null::numeric
  end as remaining_usd_value,
  case
    when v.status = 'archived' then 'excluded_archived'
    when v.available_weight_g = 0 or v.status = 'empty' then 'complete_zero'
    when v.corrected_order_mismatch then 'incomplete'
    when v.historical_consumable_cost is null or v.initial_weight_g <= 0 then 'incomplete'
    when v.acquisition_date is null then 'incomplete'
    when v.original_currency not in ('CRC', 'USD', 'EUR') then 'incomplete'
    when v.fx_snapshot_id is null then 'incomplete'
    else 'complete'
  end as fx_status,
  case
    when v.status = 'archived' or v.available_weight_g = 0 or v.status = 'empty' then null
    when v.corrected_order_mismatch then 'corrected_order_mismatch'
    when v.historical_consumable_cost is null or v.initial_weight_g <= 0 then 'missing_cost'
    when v.acquisition_date is null then 'missing_acquisition_date'
    when v.original_currency not in ('CRC', 'USD', 'EUR') then 'unsupported_currency'
    when v.fx_snapshot_id is null then 'missing_fx_snapshot'
    else null
  end as incompleteness_reason,
  v.fx_snapshot_id,
  v.fx_source,
  v.source_to_crc_rate,
  v.source_to_usd_rate,
  v.indicator_318,
  v.indicator_318_effective_date,
  v.indicator_318_raw_value,
  v.indicator_333,
  v.indicator_333_effective_date,
  v.indicator_333_raw_value
from valued v;

revoke all on table public.filament_inventory_valuation from public, anon;
grant select on table public.filament_inventory_valuation to authenticated;

comment on table public.historical_fx_snapshots is 'Snapshots BCCR inmutables por usuario, fecha de adquisición y moneda; nunca representan valor de mercado actual.';
comment on function public.record_bccr_fx_snapshot(uuid, uuid, date, text, date, numeric, date, numeric) is 'Guarda o recupera idempotentemente un snapshot BCCR validado por el servidor.';
comment on view public.filament_inventory_valuation is 'Valor histórico restante de filamento en moneda original, CRC y USD; excluye spools, archivados e insumos.';
