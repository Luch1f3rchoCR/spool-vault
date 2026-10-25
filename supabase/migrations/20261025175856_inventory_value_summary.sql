-- Valuation only: never changes stock, acquisition costs or production snapshots.
create function public.supply_payload_purchase_date(payload jsonb) returns date
language plpgsql immutable security invoker set search_path='' as $$
declare value text := payload->>'purchased_at'; parsed date;
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
 parsed:=value::date;
 if not isfinite(parsed) then return null; end if;
 return parsed;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;
revoke all on function public.supply_payload_purchase_date(jsonb) from public,anon;
grant execute on function public.supply_payload_purchase_date(jsonb) to authenticated,service_role;

-- Append-only completion for old receipts that did not record a purchase date.
create table public.supply_purchase_dates (
 movement_id uuid primary key references public.supply_movements(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 request_id uuid not null,
 purchased_at date not null check (isfinite(purchased_at)),
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
alter table public.supply_purchase_dates enable row level security;
create policy supply_purchase_dates_read on public.supply_purchase_dates for select to authenticated
 using ((select auth.uid())=user_id);
create policy supply_purchase_dates_insert on public.supply_purchase_dates for insert to authenticated
 with check ((select auth.uid())=user_id and exists(select 1 from public.supply_movements m
 where m.id=movement_id and m.user_id=(select auth.uid()) and m.quantity>0
 and public.supply_payload_purchase_date(m.request_payload) is null));
revoke all on public.supply_purchase_dates from public,anon,authenticated,service_role;
grant select,insert on public.supply_purchase_dates to authenticated;
grant select on public.supply_purchase_dates to service_role;

create function public.complete_supply_purchase_date(p_request_id uuid,p_movement_id uuid,p_purchased_at date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.supply_purchase_dates;
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if p_request_id is null or p_movement_id is null or p_purchased_at is null or not isfinite(p_purchased_at) then
  raise exception 'Completá la fecha de compra' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':supply-date-request:'||p_request_id::text,0));
 select * into saved from public.supply_purchase_dates where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if saved.movement_id<>p_movement_id or saved.purchased_at<>p_purchased_at then
   raise exception 'El intento ya se guardó con otros datos' using errcode='22023'; end if;
  return to_jsonb(saved);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':supply-date:'||p_movement_id::text,0));
 if exists(select 1 from public.supply_purchase_dates where movement_id=p_movement_id and user_id=auth.uid()) then
  raise exception 'La fecha ya se completó. Actualizá el resumen' using errcode='40001'; end if;
 insert into public.supply_purchase_dates(movement_id,user_id,request_id,purchased_at)
 values(p_movement_id,auth.uid(),p_request_id,p_purchased_at) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.complete_supply_purchase_date(uuid,uuid,date) from public,anon,service_role;
grant execute on function public.complete_supply_purchase_date(uuid,uuid,date) to authenticated;

-- Keep the existing stock checks and request payloads; validate a date when supplied.
create or replace function public.validate_supply_movement() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_stock public.supply_stock;
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Sesion requerida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||':supply:'||new.supply_id::text,0));
 select * into v_stock from public.supply_stock where id=new.supply_id and user_id=auth.uid();
 if not found then raise exception 'Insumo no encontrado'; end if;
 if new.kind='production' and (pg_trigger_depth()<2 or new.run_id is null) then raise exception 'Consumo reservado a produccion'; end if;
 if new.kind<>'production' and new.run_id is not null then raise exception 'Movimiento no valido'; end if;
 if new.kind='receipt' and new.quantity<=0 then raise exception 'La entrada debe ser positiva'; end if;
 if new.kind='production' and new.quantity>=0 then raise exception 'Consumo no valido'; end if;
 if new.quantity>0 and new.request_payload ? 'purchased_at'
  and public.supply_payload_purchase_date(new.request_payload) is null then
  raise exception 'La fecha de compra no es válida' using errcode='22023'; end if;
 if new.quantity<0 then
   if -new.quantity>v_stock.quantity then raise exception 'Saldo insuficiente de %: disponible % %',v_stock.name,v_stock.quantity,v_stock.unit; end if;
   new.unit_cost:=v_stock.unit_cost;
 end if;
 new.cost_amount:=new.quantity*new.unit_cost;
 return new;
end $$;

create function public.inventory_value_summary() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 owner_id uuid:=auth.uid(); r record; s record; g record;
 rows jsonb:='[]'; pending jsonb:='[]'; dates jsonb:='[]';
 supply_pending jsonb; supply_dates jsonb;
 qty numeric; crc numeric; usd numeric; next_qty numeric; ambiguous boolean; reason text;
begin
 if owner_id is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 for r in select v.*,f.color_name as name from public.filament_inventory_valuation v
  join public.filament_rolls f on f.id=v.roll_id and f.user_id=v.user_id
  where v.user_id=owner_id and v.status<>'archived' loop
  if r.remaining_original_value=0 then
   r.remaining_crc_value:=0;r.remaining_usd_value:=0;r.incompleteness_reason:=null;
  end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('asset_type','filament','id',r.roll_id,'name',r.name,
   'quantity',r.available_weight_g,'original_currency',r.original_currency,'remaining_original_value',r.remaining_original_value,
   'remaining_crc_value',r.remaining_crc_value,'remaining_usd_value',r.remaining_usd_value,'issue',r.incompleteness_reason));
  if r.incompleteness_reason='missing_fx_snapshot' then
   pending:=pending||jsonb_build_array(jsonb_build_object('acquisition_date',r.acquisition_date,'source_currency',r.original_currency));
  end if;
 end loop;
 for s in select * from public.supply_stock where user_id=owner_id loop
  qty:=0;crc:=0;usd:=0;ambiguous:=false;supply_pending:='[]';supply_dates:='[]';
  if s.quantity>0 then
   -- Group equal timestamps: all receipts commute, as do all withdrawals.
   -- A mixed group has no provable historical order; never guess its foreign cost.
   for g in
    select x.created_at,sum(x.quantity) as quantity,bool_or(x.quantity>0) as incoming,bool_or(x.quantity<0) as outgoing,
     sum(case when x.quantity>0 then coalesce(x.crc_cost,0) else 0 end) as crc_in,
     sum(case when x.quantity>0 then coalesce(x.usd_cost,0) else 0 end) as usd_in,
     bool_or(x.quantity>0 and x.crc_cost is null) as crc_missing,
     bool_or(x.quantity>0 and x.usd_cost is null) as usd_missing,
     coalesce(jsonb_agg(jsonb_build_object('movement_id',x.id,'supply_name',s.name,'quantity',x.quantity,
      'unit',s.unit,'recorded_at',x.created_at)) filter(where x.quantity>0 and x.cost_amount>0 and x.purchase_date is null),'[]') as missing_dates,
     coalesce(jsonb_agg(jsonb_build_object('acquisition_date',x.purchase_date,'source_currency',s.currency))
      filter(where x.quantity>0 and x.cost_amount>0 and x.purchase_date is not null and x.fx_id is null),'[]') as missing_rates
    from (
     select m.*,coalesce(d.purchased_at,public.supply_payload_purchase_date(m.request_payload)) as purchase_date,fx.id as fx_id,
      case when m.cost_amount=0 then 0 when s.currency='CRC' then m.cost_amount
       when fx.id is not null then m.cost_amount*fx.source_to_crc_rate end as crc_cost,
      case when m.cost_amount=0 then 0 when s.currency='USD' then m.cost_amount
       when fx.id is not null then m.cost_amount*fx.source_to_usd_rate end as usd_cost
     from public.supply_movements m left join public.supply_purchase_dates d on d.movement_id=m.id and d.user_id=m.user_id
     left join public.historical_fx_snapshots fx on fx.user_id=m.user_id and fx.source_currency=s.currency
      and fx.acquisition_date=coalesce(d.purchased_at,public.supply_payload_purchase_date(m.request_payload))
     where m.user_id=owner_id and m.supply_id=s.id
    ) x group by x.created_at order by x.created_at
   loop
    next_qty:=qty+g.quantity;
    if next_qty=0 then
     crc:=0;usd:=0;ambiguous:=false;supply_pending:='[]';supply_dates:='[]';
    else
     supply_pending:=supply_pending||g.missing_rates;supply_dates:=supply_dates||g.missing_dates;
     if (g.incoming and g.outgoing) or next_qty<0 then
      crc:=null;usd:=null;ambiguous:=true;
     elsif g.incoming then
      crc:=case when g.crc_missing then null else (case when qty=0 then 0 else crc end)+g.crc_in end;
      usd:=case when g.usd_missing then null else (case when qty=0 then 0 else usd end)+g.usd_in end;
     elsif qty>0 then
      crc:=crc*next_qty/qty;usd:=usd*next_qty/qty;
     else crc:=null;usd:=null;ambiguous:=true;
     end if;
    end if;
    qty:=next_qty;
   end loop;
  end if;
  -- The native balance is already frozen in the append-only stock ledger.
  if s.currency='CRC' then crc:=s.quantity*s.unit_cost; end if;
  if s.currency='USD' then usd:=s.quantity*s.unit_cost; end if;
  if s.quantity*s.unit_cost=0 then
   crc:=0;usd:=0;ambiguous:=false;supply_pending:='[]';supply_dates:='[]';
  end if;
  reason:=case when ambiguous then 'ambiguous_movement_order'
   when jsonb_array_length(supply_dates)>0 then 'missing_acquisition_date'
   when jsonb_array_length(supply_pending)>0 then 'missing_fx_snapshot' else null end;
  rows:=rows||jsonb_build_array(jsonb_build_object('asset_type','supply','id',s.id,'name',s.name,
   'quantity',s.quantity,'original_currency',s.currency,'remaining_original_value',s.quantity*s.unit_cost,
   'remaining_crc_value',crc,'remaining_usd_value',usd,'issue',reason));
  pending:=pending||supply_pending;dates:=dates||supply_dates;
 end loop;
 return jsonb_build_object('user_id',owner_id,'as_of',statement_timestamp(),'rows',rows,'missing_supply_dates',dates,
  'pending_rates',(select coalesce(jsonb_agg(p order by p->>'acquisition_date',p->>'source_currency'),'[]') from (select distinct value p from jsonb_array_elements(pending)) unique_rates));
end $$;
revoke all on function public.inventory_value_summary() from public,anon,service_role;
grant execute on function public.inventory_value_summary() to authenticated;

-- Preserve the existing account export; append the purchase-date annotations.
create or replace function public.export_my_data() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_table text; v_rows jsonb; v_tables jsonb:='{}';
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 foreach v_table in array array['supplies','supply_movements','user_profiles','filament_rolls','consumption_logs','spools','spool_types','weighing_events','suppliers',
 'purchase_history','purchase_corrections','purchase_orders','purchase_order_items','purchase_order_payments','print_projects','project_filament_requirements',
 'project_components','production_runs','production_run_filaments','production_run_components','production_run_costs','printers','tester_memberships',
 'user_feedback','tester_first_visits','filament_print_profiles','historical_fx_snapshots','supply_purchase_dates'] loop
  if to_regclass(format('public.%I',v_table)) is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where user_id=$1',v_table) into v_rows using auth.uid();
   v_tables:=v_tables||jsonb_build_object(v_table,v_rows);
  end if;
 end loop;
 return jsonb_build_object('format','spool-vault-account','version',1,'source','supabase','exported_at',now(),'user_id',auth.uid(),
 'includes_binary_files',false,'tables',v_tables,'shared_spool_types',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.spool_types s where user_id is null));
end $$;
