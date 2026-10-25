begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('da260000-0000-4000-8000-000000000001','value-owner@example.invalid',now()),
 ('da260000-0000-4000-8000-000000000002','value-other@example.invalid',now());
select public.record_bccr_fx_snapshot('da260000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-10-10','CRC','2026-10-10',500,null,null);
select public.record_bccr_fx_snapshot('da260000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-10-10','USD','2026-10-10',500,null,null);
select public.record_bccr_fx_snapshot('da260000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-10-11','USD','2026-10-11',600,null,null);
select public.record_bccr_fx_snapshot('da260000-0000-4000-8000-000000000001',gen_random_uuid(),'2026-10-12','EUR','2026-10-12',700,'2026-10-12',1.2);
set local role authenticated;
select set_config('request.jwt.claim.sub','da260000-0000-4000-8000-000000000001',true);
insert into public.filament_rolls(id,brand,material,color_name,color_hex,initial_weight_g,available_weight_g,filament_cost_amount,currency,purchase_date) values
 ('da260000-0000-4000-8000-000000000051','Test','PLA','CRC','#FFFFFF',1000,400,10000,'CRC','2026-10-10'),
 ('da260000-0000-4000-8000-000000000052','Test','PLA','USD','#FFFFFF',1000,500,20,'USD','2026-10-11'),
 ('da260000-0000-4000-8000-000000000053','Test','PLA','Archived','#FFFFFF',1000,1000,99999,'CRC','2026-10-10'),
 ('da260000-0000-4000-8000-000000000054','Test','PLA','Free filament','#FFFFFF',1000,100,0,'USD',null);
update public.filament_rolls set status='archived' where id='da260000-0000-4000-8000-000000000053';
insert into public.supplies(id,name,category,unit,currency) values
 ('da260000-0000-4000-8000-000000000011','Weighted pins','Pines','unidad','USD'),
 ('da260000-0000-4000-8000-000000000012','Legacy magnets','Imanes','unidad','CRC'),
 ('da260000-0000-4000-8000-000000000013','Missing rate','Otros','unidad','USD'),
 ('da260000-0000-4000-8000-000000000014','Empty catalog','Otros','unidad','CRC'),
 ('da260000-0000-4000-8000-000000000015','New cycle','Otros','unidad','EUR'),
 ('da260000-0000-4000-8000-000000000016','Ambiguous','Otros','unidad','USD'),
 ('da260000-0000-4000-8000-000000000017','Free stock','Otros','unidad','EUR');
create function pg_temp.enter_stock(suffix integer,supply integer,q numeric,cost numeric,stamp text,day text default null)
returns void language plpgsql as $$ begin
 insert into public.supply_movements(id,supply_id,request_id,request_payload,kind,quantity,unit_cost,cost_amount,reason,created_at)
 values(('da260000-0000-4000-8000-'||lpad(suffix::text,12,'0'))::uuid,
 ('da260000-0000-4000-8000-'||lpad(supply::text,12,'0'))::uuid,gen_random_uuid(),
 case when day is null then '{}'::jsonb else jsonb_build_object('purchased_at',day) end,
 case when q>0 then 'receipt' else 'adjustment' end,q,cost,0,'Fixture',stamp::timestamptz);
end $$;
select pg_temp.enter_stock(101,11,100,1,'2026-10-10 10:00Z','2026-10-10');
select pg_temp.enter_stock(102,11,-60,0,'2026-10-10 11:00Z');
select pg_temp.enter_stock(103,11,100,2,'2026-10-11 10:00Z','2026-10-11');
select pg_temp.enter_stock(104,11,-70,0,'2026-10-11 11:00Z');
select pg_temp.enter_stock(105,12,10,100,'2026-10-10 10:00Z');
select pg_temp.enter_stock(106,13,5,2,'2026-10-12 10:00Z','2026-10-12');
select pg_temp.enter_stock(107,15,100,1,'2026-10-09 10:00Z');
select pg_temp.enter_stock(108,15,-100,0,'2026-10-09 11:00Z');
select pg_temp.enter_stock(109,15,100,2,'2026-10-12 10:00Z','2026-10-12');
select pg_temp.enter_stock(110,16,100,1,'2026-10-10 10:00Z','2026-10-10');
select pg_temp.enter_stock(111,16,-20,0,'2026-10-10 10:00Z');
select pg_temp.enter_stock(113,17,100,0,'2026-10-10 10:00Z');
select pg_temp.enter_stock(114,17,-20,0,'2026-10-10 10:00Z');
do $$
declare data jsonb; row jsonb; before_ledger jsonb; saved jsonb; replay jsonb; request uuid:=gen_random_uuid();
begin
 data:=public.inventory_value_summary();
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Free stock';
 assert (row->>'remaining_crc_value')::numeric=0 and (row->>'remaining_usd_value')::numeric=0,'free stock fabricated uncertainty';
 assert data->>'user_id'=auth.uid()::text,'summary owner mismatch';
 assert not exists(select 1 from jsonb_array_elements(data->'rows') r where r->>'name'='Archived'),'archived included';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Free filament';
 assert (row->>'remaining_crc_value')::numeric=0 and (row->>'remaining_usd_value')::numeric=0,'zero-cost filament needs no invented rate';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Weighted pins';
 assert (row->>'quantity')::numeric=70,'remaining quantity';
 assert abs((row->>'remaining_crc_value')::numeric-70000)<0.000001,'historical weighted CRC after two withdrawals';
 assert abs((row->>'remaining_usd_value')::numeric-120)<0.000001,'native weighted USD';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Legacy magnets';
 assert (row->>'remaining_crc_value')::numeric=1000 and row->'remaining_usd_value'='null'::jsonb,'missing date fabricated conversion';
 assert jsonb_array_length(data->'missing_supply_dates')=1,'consumed legacy cycle still needs date';
 assert jsonb_array_length(data->'pending_rates')=1,'pending rates not distinct/current cycle';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='New cycle';
 assert (row->>'remaining_crc_value')::numeric=168000 and (row->>'remaining_usd_value')::numeric=240,'zero-stock cycle did not reset unknown history';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Ambiguous';
 assert row->'remaining_crc_value'='null'::jsonb and row->>'issue'='ambiguous_movement_order','guessed simultaneous order';
 select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') into before_ledger from public.supply_movements m;
 saved:=public.complete_supply_purchase_date(request,'da260000-0000-4000-8000-000000000105','2026-10-10');
 replay:=public.complete_supply_purchase_date(request,'da260000-0000-4000-8000-000000000105','2026-10-10');
 assert saved=replay,'date retry changed result';
 begin
  perform public.complete_supply_purchase_date(request,'da260000-0000-4000-8000-000000000105','2026-10-11');
  assert false,'changed retry accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.complete_supply_purchase_date(gen_random_uuid(),'da260000-0000-4000-8000-000000000105','2026-10-11');
  assert false,'date overwritten';
 exception when serialization_failure then null; end;
 assert before_ledger=(select jsonb_agg(to_jsonb(m) order by m.id) from public.supply_movements m),'completing date rewrote purchase/consumption';
 data:=public.inventory_value_summary();
 assert jsonb_array_length(data->'missing_supply_dates')=0,'date not resolved';
 select r into row from jsonb_array_elements(data->'rows') r where r->>'name'='Legacy magnets';
 assert (row->>'remaining_usd_value')::numeric=2,'completed date not used';
 assert jsonb_array_length(public.export_my_data()->'tables'->'supply_purchase_dates')=1,'date export missing';
 assert jsonb_array_length(public.export_my_data()->'tables'->'historical_fx_snapshots')=4,'FX provenance export missing';
 begin
  perform pg_temp.enter_stock(112,12,1,100,'2026-10-10 12:00Z','not-a-date');
  assert false,'invalid acquisition date accepted';
 exception when invalid_parameter_value then null; end;
 begin
  delete from public.supply_purchase_dates;assert false,'date deleted';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','da260000-0000-4000-8000-000000000002',true);
do $$ begin
 assert jsonb_array_length(public.inventory_value_summary()->'rows')=0,'foreign inventory exposed';
 assert (select count(*)=0 from public.supply_purchase_dates),'foreign dates exposed';
 begin
  perform public.complete_supply_purchase_date(gen_random_uuid(),'da260000-0000-4000-8000-000000000105','2026-10-10');
  assert false,'foreign date accepted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.inventory_value_summary()','EXECUTE'),'anonymous summary';
 assert (select provolatile='s' and not prosecdef from pg_proc where oid='public.inventory_value_summary()'::regprocedure),'summary must be snapshot-consistent, read-only and invoker';
 assert not has_table_privilege('authenticated','public.supply_purchase_dates','UPDATE'),'mutable date';
 assert not has_table_privilege('service_role','public.supply_purchase_dates','DELETE'),'service inherited delete';
end $$;
rollback;
