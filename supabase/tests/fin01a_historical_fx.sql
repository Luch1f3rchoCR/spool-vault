-- Local only: FIN-01A historical valuation fixtures are fully rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('f1000000-0000-4000-8000-000000000001','fin-owner@example.invalid',now(),false),
 ('f1000000-0000-4000-8000-000000000002','fin-other@example.invalid',now(),false);

create temp table fin_ids(name text primary key, id uuid not null);
grant all on fin_ids to authenticated, service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
do $$
declare
 v_created jsonb; v_order jsonb; v_roll uuid; v_purchase uuid;
begin
 -- CRC purchase-order roll: consumable 9,000 + landed shipping 1,000, then 50% consumed.
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN','Landed','PLA','CRC landed','#111111',1000,1000,200,null,'2026-09-01',10000,'CRC','FIN supplier','spooled',1000,null,null,null);
 v_roll:=(v_created->'roll'->>'id')::uuid; v_purchase:=(v_created->'purchase'->>'id')::uuid;
 insert into fin_ids values('crc_landed',v_roll);
 v_order:=public.create_purchase_order_v2(gen_random_uuid(),array[v_purchase],'2026-09-01',1000,0,'per_unit','actual',null,'{}',11,'USD',0.001,'2026-09-01','paid','payment FX is not inventory FX');
 perform public.record_consumption(gen_random_uuid(),v_roll,'FIN partial',500,'2026-09-02',null);

 -- Legacy USD and EUR rolls retain their filament-only fallback cost.
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','USD legacy','#222222',1000,1000,200,null,'2026-09-02',22,'USD','FIN supplier','spooled',2,null,null,null);
 insert into fin_ids values('usd_legacy',(v_created->'roll'->>'id')::uuid);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','EUR legacy','#333333',1000,1000,200,null,'2026-09-03',12,'EUR','FIN supplier','spooled',2,null,null,null);
 insert into fin_ids values('eur_legacy',(v_created->'roll'->>'id')::uuid);

 -- Three immutable order bases that will receive incompatible append-only corrections.
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Corrected date','#883333',1000,1000,200,null,'2026-09-08',10,'CRC','FIN supplier','refill',0,null,null,null);
 v_roll:=(v_created->'roll'->>'id')::uuid; v_purchase:=(v_created->'purchase'->>'id')::uuid;
 insert into fin_ids values('corrected_date',v_roll),('corrected_date_purchase',v_purchase);
 v_order:=public.create_purchase_order_v2(gen_random_uuid(),array[v_purchase],'2026-09-08',0,0,'per_unit','actual',null,'{}',null,null,null,null,null,null);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Corrected currency','#338833',1000,1000,200,null,'2026-09-08',10,'CRC','FIN supplier','refill',0,null,null,null);
 v_roll:=(v_created->'roll'->>'id')::uuid; v_purchase:=(v_created->'purchase'->>'id')::uuid;
 insert into fin_ids values('corrected_currency',v_roll),('corrected_currency_purchase',v_purchase);
 v_order:=public.create_purchase_order_v2(gen_random_uuid(),array[v_purchase],'2026-09-08',0,0,'per_unit','actual',null,'{}',null,null,null,null,null,null);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Corrected cost','#333388',1000,1000,200,null,'2026-09-08',10,'CRC','FIN supplier','refill',0,null,null,null);
 v_roll:=(v_created->'roll'->>'id')::uuid; v_purchase:=(v_created->'purchase'->>'id')::uuid;
 insert into fin_ids values('corrected_cost',v_roll),('corrected_cost_purchase',v_purchase);
 v_order:=public.create_purchase_order_v2(gen_random_uuid(),array[v_purchase],'2026-09-08',0,0,'per_unit','actual',null,'{}',null,null,null,null,null,null);

 -- Empty, archived, missing-FX and missing-cost cases.
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Empty','#444444',1000,0,200,null,'2026-09-04',10,'USD','FIN supplier','refill',0,null,null,null);
 insert into fin_ids values('empty',(v_created->'roll'->>'id')::uuid);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Archived','#555555',1000,1000,200,null,'2026-09-05',10,'CRC','FIN supplier','refill',0,null,null,null);
 insert into fin_ids values('archived',(v_created->'roll'->>'id')::uuid);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Missing FX','#666666',1000,1000,200,null,'2026-09-06',10,'CRC','FIN supplier','refill',0,null,null,null);
 insert into fin_ids values('missing_fx',(v_created->'roll'->>'id')::uuid);
 v_created:=public.create_roll_with_purchase(gen_random_uuid(),'FIN',null,'PLA','Missing cost','#777777',1000,1000,200,null,'2026-09-07',null,'CRC','FIN supplier','refill',0,null,null,null);
 insert into fin_ids values('missing_cost',(v_created->'roll'->>'id')::uuid);
end $$;

reset role;
update public.filament_rolls set status='archived' where id=(select id from fin_ids where name='archived');
create temp table corrected_order_before as
select
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_orders x
   where x.id in (select order_id from public.purchase_order_items where roll_id in
     (select id from fin_ids where name in ('corrected_date','corrected_currency','corrected_cost')))) orders,
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_order_items x
   where x.roll_id in (select id from fin_ids where name in ('corrected_date','corrected_currency','corrected_cost'))) items;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
do $$ begin
 perform public.correct_purchase(gen_random_uuid(),(select id from fin_ids where name='corrected_date_purchase'),
   'FIN supplier','2026-09-09','refill',10,0,'CRC','Correct acquisition date');
 perform public.correct_purchase(gen_random_uuid(),(select id from fin_ids where name='corrected_currency_purchase'),
   'FIN supplier','2026-09-08','refill',10,0,'USD','Correct purchase currency');
 perform public.correct_purchase(gen_random_uuid(),(select id from fin_ids where name='corrected_cost_purchase'),
   'FIN supplier','2026-09-08','refill',12,0,'CRC','Correct consumable cost');
end $$;

reset role;
create temp table fin_before as
select
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_history x) purchases,
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_orders x) orders,
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_order_items x) items,
 (select jsonb_agg(to_jsonb(x) order by x.order_id) from public.purchase_order_payments x) payments,
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_corrections x) corrections,
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.filament_rolls x) rolls;

set local role service_role;
do $$
declare v_first public.historical_fx_snapshots; v_retry public.historical_fx_snapshots; v_count integer;
begin
 v_first:=public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010','2026-09-01','CRC','2026-09-01',500,null,null);
 v_retry:=public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010','2026-09-01','CRC','2026-09-01',500,null,null);
 assert v_retry.id=v_first.id, 'idempotent retry returned another snapshot';
 v_retry:=public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-09-01','CRC','2026-09-01',999,null,null);
 assert v_retry.id=v_first.id and v_retry.indicator_318_raw_value=500, 'natural-key reuse revalued history';
 select count(*) into v_count from public.historical_fx_snapshots where acquisition_date='2026-09-01';
 assert v_count=1, 'snapshot reuse duplicated history';
 begin
  perform public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010','2026-09-01','CRC','2026-09-01',501,null,null);
  raise exception 'changed retry accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;

 perform public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-09-02','USD','2026-09-02',510,null,null);
 perform public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-09-03','EUR','2026-09-03',500,'2026-09-03',1.1);
 begin
  update public.historical_fx_snapshots set indicator_318_raw_value=600 where id=v_first.id;
  raise exception 'snapshot update accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
do $$
declare v public.filament_inventory_valuation;
begin
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='crc_landed');
 assert v.cost_basis_source='purchase_order_landed' and v.historical_consumable_cost=10000, 'landed cost not used';
 assert v.fx_status='complete' and v.remaining_original_value=5000 and v.remaining_crc_value=5000 and v.remaining_usd_value=10, 'uncorrected order valuation failed';

 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='usd_legacy');
 assert v.cost_basis_source='legacy_filament_cost' and v.historical_consumable_cost=20, 'legacy fallback failed';
 assert v.remaining_usd_value=20 and v.remaining_crc_value=10200, 'USD valuation failed';

 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='eur_legacy');
 assert v.remaining_original_value=10 and v.remaining_usd_value=11 and v.remaining_crc_value=5500, 'EUR cross rates failed';
 assert v.indicator_318=318 and v.indicator_333=333, 'EUR provenance missing';

 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='empty');
 assert v.fx_status='complete_zero' and v.remaining_crc_value=0 and v.remaining_usd_value=0;
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='archived');
 assert v.fx_status='excluded_archived' and v.remaining_crc_value=0 and v.remaining_usd_value=0;
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='missing_fx');
 assert v.incompleteness_reason='missing_fx_snapshot' and v.remaining_crc_value=10 and v.remaining_usd_value is null;
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='missing_cost');
 assert v.incompleteness_reason='missing_cost' and v.remaining_original_value is null;

 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='corrected_date');
 assert v.fx_status='incomplete' and v.incompleteness_reason='corrected_order_mismatch'
   and v.cost_basis_source='corrected_order_mismatch' and v.remaining_original_value is null, 'corrected date used stale order basis';
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='corrected_currency');
 assert v.fx_status='incomplete' and v.incompleteness_reason='corrected_order_mismatch'
   and v.original_currency='USD' and v.remaining_crc_value is null, 'corrected currency used stale order basis';
 select * into strict v from public.filament_inventory_valuation where roll_id=(select id from fin_ids where name='corrected_cost');
 assert v.fx_status='incomplete' and v.incompleteness_reason='corrected_order_mismatch'
   and v.historical_consumable_cost is null, 'corrected cost combined with stale allocations';
end $$;

-- A different authenticated user sees neither snapshots nor valuation rows.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
do $$ begin
 assert (select count(*) from public.historical_fx_snapshots)=0, 'snapshot RLS leak';
 assert (select count(*) from public.filament_inventory_valuation)=0, 'valuation RLS leak';
 begin
  perform public.record_bccr_fx_snapshot('f1000000-0000-4000-8000-000000000002',gen_random_uuid(),'2026-09-01','CRC','2026-09-01',500,null,null);
  raise exception 'authenticated caller reached server-only snapshot RPC' using errcode='ZX001';
 exception when sqlstate '42501' then null; end;
end $$;

reset role;
do $$ begin
 assert (select orders from corrected_order_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_orders x
   where x.id in (select order_id from public.purchase_order_items where roll_id in
     (select id from fin_ids where name in ('corrected_date','corrected_currency','corrected_cost')))), 'correction mutated original orders';
 assert (select items from corrected_order_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_order_items x
   where x.roll_id in (select id from fin_ids where name in ('corrected_date','corrected_currency','corrected_cost'))), 'correction mutated original items';
 assert (select purchases from fin_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_history x), 'purchase history mutated';
 assert (select orders from fin_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_orders x), 'orders mutated';
 assert (select items from fin_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_order_items x), 'order items mutated';
 assert (select payments from fin_before) is not distinct from (select jsonb_agg(to_jsonb(x) order by x.order_id) from public.purchase_order_payments x), 'payments mutated';
 assert (select corrections from fin_before) is not distinct from (select jsonb_agg(to_jsonb(x) order by x.id) from public.purchase_corrections x), 'corrections mutated';
 assert (select rolls from fin_before)=(select jsonb_agg(to_jsonb(x) order by x.id) from public.filament_rolls x), 'rolls mutated';
end $$;
rollback;
