create or replace view public.filament_balance_report
with (security_invoker = true)
as
select
  r.id as roll_id,
  r.user_id,
  r.brand,
  r.material,
  r.product_line,
  r.color_name,
  r.color_hex,
  r.initial_weight_g,
  r.available_weight_g,
  round(r.available_weight_g / nullif(r.initial_weight_g, 0) * 100, 2) as remaining_percent,
  r.low_threshold_g,
  r.status,
  r.location,
  r.package_type,
  s.name as supplier_name,
  r.purchase_date,
  r.price_amount as purchase_total,
  r.spool_cost_amount,
  r.filament_cost_amount,
  r.currency,
  round(r.filament_cost_amount / nullif(r.initial_weight_g, 0), 4) as filament_cost_per_g,
  round(
    r.available_weight_g / nullif(r.initial_weight_g, 0) * r.filament_cost_amount,
    2
  ) as remaining_filament_value,
  case when r.filament_cost_amount is null then 'incomplete' else 'recorded' end as cost_status,
  sp.code as spool_code,
  sp.tare_weight_g as spool_tare_weight_g,
  sp.status as spool_status,
  r.qr_payload,
  r.nfc_tag_id,
  r.created_at,
  r.updated_at
from public.filament_rolls r
left join public.suppliers s
  on s.id = r.supplier_id
 and s.user_id = r.user_id
left join public.spools sp
  on sp.id = r.spool_id
 and sp.user_id = r.user_id;

revoke all on table public.filament_balance_report from public, anon;
grant select on table public.filament_balance_report to authenticated;

comment on view public.filament_balance_report is
  'Saldo consistente por rollo; conserva montos y monedas originales sin conversion implicita.';
