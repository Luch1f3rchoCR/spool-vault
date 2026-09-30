-- Synthetic fixtures only. All changes are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('d2000000-0000-4000-8000-000000000001','supplies-owner@example.invalid',now()),
 ('d2000000-0000-4000-8000-000000000002','supplies-other@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',true);
do $$
declare
 v_request uuid:=gen_random_uuid(); v_payload jsonb:='{"supply_id":null,"name":"Iman 6x2","category":"Imanes","unit":"unidad","currency":"CRC","kind":"receipt","quantity":10,"unit_cost":100,"reason":"Initial test"}';
 v_result jsonb; v_id uuid; v_project uuid:=gen_random_uuid(); v_roll uuid; v_recipe jsonb; v_values jsonb; v_run jsonb; v_run_request uuid:=gen_random_uuid(); v_bad jsonb;
begin
 v_result:=public.record_supply_movement(v_request,v_payload);
 v_id:=(v_result->'supply'->>'id')::uuid;
 assert (v_result->'supply'->>'quantity')::numeric=10;
 assert (public.record_supply_movement(v_request,v_payload)->>'replayed')::boolean;
 assert (select count(*) from public.supply_movements)=1;
 begin
  perform public.record_supply_movement(v_request,v_payload||'{"quantity":20}');
  raise exception 'changed payload accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 for v_bad in select value from jsonb_array_elements('[{"quantity":0},{"quantity":-1},{"quantity":"NaN"},{"unit_cost":"NaN"},{"quantity":0.0001},{"unit_cost":-1}]') loop
  begin
   perform public.record_supply_movement(gen_random_uuid(),v_payload||v_bad);
   raise exception 'invalid accepted' using errcode='ZX001';
  exception when sqlstate 'ZX001' then raise; when others then null; end;
 end loop;
 assert (select count(*) from public.supplies)=1,'failed creation leaked supply';
 perform public.record_supply_movement(gen_random_uuid(),v_payload||jsonb_build_object('supply_id',v_id,'unit_cost',200));
 assert (select quantity=20 and unit_cost=150 from public.supply_stock where id=v_id),'weighted average';
 v_result:=public.create_roll_with_purchase(gen_random_uuid(),'Test',null,'PLA','Test white','#FFFFFF',1000,1000,200,null,'2026-09-27',5000,'CRC','Test Shop','refill',0,null,null,null);
 v_roll:=(v_result->'roll'->>'id')::uuid;
 v_recipe:=public.create_print_project(v_project,gen_random_uuid(),'Supply test',null,null,null,null,null,null,false,60,
 jsonb_build_array(jsonb_build_object('roll_id',v_roll,'planned_grams',10,'label','body')),
 jsonb_build_array(jsonb_build_object('supply_id',v_id,'quantity',2),jsonb_build_object('supply_id',v_id,'quantity',3),
 jsonb_build_object('name','Manual extra','quantity',1,'unit_cost',50,'currency','CRC')));
 assert (select quantity=20 from public.supply_stock where id=v_id),'recipe consumed stock';
 assert (v_recipe->'components'->0->>'unit_cost')::numeric=150;
 v_values:=jsonb_build_object('project_id',v_project,'produced_at','2026-09-27','quantity',1,'status','completed',
 'actual_minutes',60,'actual_labor_minutes',0,'failure_cost_amount',0,'printer_id',null,'sale_amount',null,'sale_currency',null,'notes','',
 'filaments',jsonb_build_array(jsonb_build_object('requirement_id',v_recipe->'requirements'->0->>'id','roll_id',v_roll,'grams_used',10)),
 'components',jsonb_build_array(jsonb_build_object('component_id',v_recipe->'components'->0->>'id','quantity',2),jsonb_build_object('component_id',v_recipe->'components'->1->>'id','quantity',3),jsonb_build_object('component_id',v_recipe->'components'->2->>'id','quantity',1)));
 v_run:=public.complete_production_run_v4(v_run_request,v_values);
 assert (select quantity=15 and unit_cost=150 from public.supply_stock where id=v_id);
 assert (select available_weight_g=990 from public.filament_rolls where id=v_roll);
 assert (select count(*) from public.supply_movements)=4,'manual extra consumed stock';
 assert (select sum(cost_amount)=800 from public.production_run_components),'cost snapshot';
 assert (public.complete_production_run_v4(v_run_request,v_values)->>'replayed')::boolean;
 assert (select quantity=15 from public.supply_stock where id=v_id),'replay consumed twice';
 begin
  perform public.complete_production_run_v4(v_run_request,jsonb_set(v_values,'{quantity}','2'));
  raise exception 'changed run payload accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 -- Two lines individually fit but together exceed available stock; everything rolls back.
 begin
  perform public.complete_production_run_v4(gen_random_uuid(),jsonb_set(jsonb_set(v_values,'{components,0,quantity}','10'),'{components,1,quantity}','10'));
  raise exception 'shortage accepted' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;
 assert (select quantity=15 from public.supply_stock where id=v_id),'partial supply write';
 assert (select available_weight_g=990 from public.filament_rolls where id=v_roll),'filament not rolled back';
 assert (select count(*) from public.production_runs)=1;
 perform public.record_supply_movement(gen_random_uuid(),v_payload||jsonb_build_object('supply_id',v_id,'quantity',5,'unit_cost',350));
 assert (select quantity=20 and unit_cost=200 from public.supply_stock where id=v_id);
 assert (select sum(cost_amount)=800 from public.production_run_components),'history changed';
 -- A replay after restock still returns original cost snapshots.
 assert public.complete_production_run_v4(v_run_request,v_values)->'components'=v_run->'components';
 perform public.record_supply_movement(gen_random_uuid(),v_payload||jsonb_build_object('supply_id',v_id,'kind','adjustment','quantity',-1,'unit_cost',999));
 assert (select quantity=19 and unit_cost=200 from public.supply_stock where id=v_id),'withdrawal should use current average';
 begin
  update public.supply_movements set quantity=99 where supply_id=v_id;
  raise exception 'history editable' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 assert (public.export_my_data()->'tables') ? 'supply_movements';
 perform set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000002',true);
 assert (select count(*) from public.supply_stock)=0,'stock leaked';
 assert (select count(*) from public.supply_movements)=0,'history leaked';
 begin
  perform public.record_supply_movement(gen_random_uuid(),v_payload||jsonb_build_object('supply_id',v_id));
  raise exception 'cross owner allowed' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then null; end;
end $$;
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',true);
set constraints all immediate;
rollback;
