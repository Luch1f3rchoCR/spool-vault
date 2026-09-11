-- Local only: synthetic users, all fixtures rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('d1000000-0000-4000-8000-000000000001','orders-owner@example.invalid',now(),false),
 ('d1000000-0000-4000-8000-000000000002','orders-other@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
do $$
declare
 v_payload jsonb := '{"purchase_ids":[],"new_rolls":[
 {"line_id":"d1000000-0000-4000-8000-000000000010","brand":"Bambu Lab","material":"PLA","product_line":"PLA Matte","color_name":"Test Matte","color_hex":"#D3B7A7","quantity_g":1000,"total_price":11500,"package_type":"refill","spool_cost":0,"location":"Lab"},
 {"line_id":"d1000000-0000-4000-8000-000000000011","brand":"Bambu Lab","material":"PLA","product_line":"PLA Silk+","color_name":"Test Silk","color_hex":"#D02727","quantity_g":1000,"total_price":12500,"package_type":"spooled","spool_cost":1000,"location":"Lab"}],
 "supplier_name":"Test Shop","currency":"CRC","purchased_at":"2026-09-10","shipping_amount":3000,"other_charges_amount":0,"allocation_method":"per_unit","cost_confidence":"actual","notes":"Synthetic test","manual_allocations":{},"paid_amount":27000,"paid_currency":"CRC","exchange_rate":1,"exchange_rate_date":"2026-09-10","exchange_rate_kind":"paid","exchange_rate_source":"test"}';
 v_request uuid := gen_random_uuid(); v_result jsonb; v_retry jsonb; v_bad jsonb;
 v_count integer; v_roll uuid; v_purchase uuid; v_existing jsonb;
begin
 v_result := public.create_purchase_order_v3(v_request,v_payload);
 assert (v_result->'order'->>'total_amount')::numeric=27000;
 assert jsonb_array_length(v_result->'rolls')=2;
 assert jsonb_array_length(v_result->'purchases')=2;
 assert (select sum((value->>'available_weight_g')::numeric) from jsonb_array_elements(v_result->'rolls'))=2000;
 assert (select sum((value->>'spool_cost')::numeric) from jsonb_array_elements(v_result->'items'))=1000;
 assert (select sum((value->>'allocated_shipping')::numeric) from jsonb_array_elements(v_result->'items'))=3000;
 assert (v_result->'payment'->>'paid_amount')::numeric=27000;
 -- Replay after consumption must return today's balance, not the saved initial weight.
 v_roll := (v_result->'rolls'->0->>'id')::uuid;
 insert into public.consumption_logs(roll_id,grams_used,consumed_at,project_name)
 values(v_roll,10,'2026-09-10','Test use');
 v_retry := public.create_purchase_order_v3(v_request,v_payload);
 assert (v_retry->>'replayed')::boolean;
 assert v_retry->'order'=v_result->'order';
 assert (select sum((value->>'available_weight_g')::numeric) from jsonb_array_elements(v_retry->'rolls'))=1990;
 assert (select count(*) from public.filament_rolls)=2;
 assert (select count(*) from public.purchase_orders)=1;
 begin
  perform public.create_purchase_order_v3(v_request,jsonb_set(v_payload,'{shipping_amount}','4000'));
  raise exception 'changed payload accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 -- Failure in the second roll, invalid payment and invalid manual allocation
 -- all happen after potential writes, yet must roll back the entire operation.
 for v_bad in select value from jsonb_array_elements(jsonb_build_array(
   jsonb_set(v_payload,'{new_rolls,1,color_hex}','"invalid"'),
   jsonb_set(v_payload,'{exchange_rate}','2'),
   jsonb_set(v_payload,'{allocation_method}','"manual"'),
   jsonb_set(v_payload,'{new_rolls,0,spool_cost}','1000'),
   jsonb_set(v_payload,'{new_rolls,1,line_id}',v_payload->'new_rolls'->0->'line_id'),
   jsonb_set(v_payload,'{shipping_amount}','"NaN"'),
   jsonb_set(v_payload,'{cost_confidence}','null')
 )) loop
  begin
   perform public.create_purchase_order_v3(gen_random_uuid(),v_bad);
   raise exception 'invalid order accepted' using errcode='ZX001';
  exception when sqlstate 'ZX001' then raise; when others then null; end;
  assert (select count(*) from public.filament_rolls)=2, 'failed order leaked rolls';
  assert (select count(*) from public.purchase_history)=2, 'failed order leaked purchases';
  assert (select count(*) from public.purchase_orders)=1;
 end loop;
 -- Mix a pre-existing purchase and a new roll, with manual allocation keys.
 v_existing := public.create_roll_with_purchase(gen_random_uuid(),'Test',null,'PLA','Existing','#FFFFFF',1000,1000,200,null,'2026-09-10',5000,'CRC','Test Shop','refill',0,null,null,null);
 v_purchase := (v_existing->'purchase'->>'id')::uuid;
 v_bad := jsonb_set(v_payload,'{purchase_ids}',jsonb_build_array(v_purchase));
 v_bad := jsonb_set(v_bad,'{new_rolls}',jsonb_build_array(v_payload->'new_rolls'->0));
 v_bad := v_bad || jsonb_build_object('allocation_method','manual','manual_allocations',jsonb_build_object(v_purchase::text,jsonb_build_object('shipping',500,'other',0),v_payload->'new_rolls'->0->>'line_id',jsonb_build_object('shipping',2500,'other',0)),'paid_amount',19500);
 v_retry := public.create_purchase_order_v3(gen_random_uuid(),v_bad);
 assert jsonb_array_length(v_retry->'items')=2;
 assert (select count(*) from public.filament_rolls)=4;
 assert (v_retry->'order'->>'total_amount')::numeric=19500;
 assert (select allocated_shipping from public.purchase_order_items where purchase_history_id=v_purchase)=500;
 -- Already-linked purchases cannot generate another order/new roll.
 begin
  perform public.create_purchase_order_v3(gen_random_uuid(),v_bad);
  raise exception 'duplicate assignment accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;
 assert (select count(*) from public.filament_rolls)=4;
 -- Cross-account requests reveal no order and cannot reference another user's purchase.
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
 assert (select count(*) from public.purchase_order_creation_requests)=0;
 assert (select count(*) from public.purchase_orders)=0;
 begin
  perform public.create_purchase_order_v3(gen_random_uuid(),v_bad);
  raise exception 'cross-user order accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;
 assert (select count(*) from public.filament_rolls)=0;
 assert (select count(*) from public.suppliers)=0;
end $$;
-- Deferred owner checks must run as the account that created these fixtures.
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
set constraints all immediate;
rollback;
