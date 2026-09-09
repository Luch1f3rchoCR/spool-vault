-- Run after printer_cost_safety. All fixtures and changes are rolled back.
begin;
insert into auth.users(id, email, email_confirmed_at, is_anonymous) values
 ('d0900000-0000-4000-8000-000000000001', 'printer-owner@example.invalid', now(), false),
 ('d0900000-0000-4000-8000-000000000002', 'printer-other@example.invalid', now(), false);
insert into public.printers(id,user_id,creation_request_id,name,machine_cost_per_hour,machine_cost_currency)
values ('d0900000-0000-4000-8000-000000000010','d0900000-0000-4000-8000-000000000002',gen_random_uuid(),'Other printer',100,'CRC');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0900000-0000-4000-8000-000000000001', true);
insert into public.user_profiles(user_id, production_cost_currency, electricity_price_per_kwh, printer_average_power_w, machine_cost_per_hour, labor_cost_per_hour)
values(auth.uid(),'CRC',100,100,60,120)
on conflict(user_id) do update set production_cost_currency='CRC', electricity_price_per_kwh=100, printer_average_power_w=100, machine_cost_per_hour=60, labor_cost_per_hour=120;
insert into public.filament_rolls(id,brand,material,color_name,color_hex,initial_weight_g,available_weight_g,filament_cost_amount,currency)
values('d0900000-0000-4000-8000-000000000020','Test','PLA','Test','#FFFFFF',1000,1000,10000,'CRC');
insert into public.print_projects(id,creation_request_id,name)
values('d0900000-0000-4000-8000-000000000030',gen_random_uuid(),'Printer test');
insert into public.project_filament_requirements(id,project_id,position,brand,material,color_name,color_hex,planned_grams)
values('d0900000-0000-4000-8000-000000000040','d0900000-0000-4000-8000-000000000030',1,'Test','PLA','Test','#FFFFFF',10);

create function pg_temp.test_run(request uuid, printer uuid, minutes integer default 60)
returns jsonb language sql as $$
select public.complete_production_run_v3(
request,'d0900000-0000-4000-8000-000000000030','2026-09-08',1,'completed',minutes,null,null,null,
'[{"requirement_id":"d0900000-0000-4000-8000-000000000040","roll_id":"d0900000-0000-4000-8000-000000000020","grams_used":10}]',
'[]',30,0,printer);
$$;

do $$
declare
 v_create uuid := gen_random_uuid(); v_edit uuid := gen_random_uuid(); v_edit2 uuid := gen_random_uuid();
 v_run_request uuid := gen_random_uuid(); v_general_request uuid := gen_random_uuid();
 v_printer uuid; a jsonb; b jsonb; frozen jsonb; n integer;
begin
 a := public.save_printer_v2(v_create,null,'P1S','Bambu Lab','P1S',null,'Taller',200,120,null,true,'CRC');
 v_printer := (a->'printer'->>'id')::uuid;
 b := public.save_printer_v2(v_create,null,'P1S','Bambu Lab','P1S',null,'Taller',200,120,null,true,'CRC');
 assert (b->>'replayed')::boolean and a->'printer'->>'id'=b->'printer'->>'id', 'duplicate create';
 assert (select count(*)=1 from public.printers), 'RLS leaked printers';
 begin
  perform public.save_printer_v2(v_create,null,'Changed','Bambu Lab','P1S',null,'Taller',200,120,null,true,'CRC');
  assert false, 'mismatched printer retry accepted';
 exception when invalid_parameter_value then null; end;
 a := pg_temp.test_run(v_run_request,v_printer);
 frozen := a->'costs';
 assert (frozen->>'machine_cost_amount')::numeric=120, 'incorrect machine cost';
 assert (frozen->>'electricity_cost_amount')::numeric=20, 'incorrect electricity cost';
 assert (frozen->>'labor_cost_amount')::numeric=60, 'incorrect labor cost';
 assert (select available_weight_g=990 from public.filament_rolls), 'first consumption wrong';

 perform public.save_printer_v2(v_edit,v_printer,'Renamed','Bambu Lab','P1S',0.6,'Office',300,240,null,true,'CRC');
 perform public.save_printer_v2(v_edit2,v_printer,'Newest','Bambu Lab','P1S',0.6,'Office',300,300,null,false,'USD');
 -- Delayed replay of an older edit does not overwrite the newer version.
 b := public.save_printer_v2(v_edit,v_printer,'Renamed','Bambu Lab','P1S',0.6,'Office',300,240,null,true,'CRC');
 assert b->'printer'->>'name'='Newest', 'old retry overwrote new edit';
 update public.user_profiles set production_cost_currency='EUR',machine_cost_per_hour=999 where user_id=auth.uid();
 b := pg_temp.test_run(v_run_request,v_printer);
 assert b->'costs'=frozen and (b->>'replayed')::boolean, 'retry recalculated snapshot';
 assert (select available_weight_g=990 from public.filament_rolls), 'retry consumed twice';
 assert (select count(*)=1 from public.consumption_logs), 'duplicate consumption log';
 begin
  perform pg_temp.test_run(v_run_request,v_printer,120);
  assert false, 'mismatched run retry accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform pg_temp.test_run(gen_random_uuid(),v_printer);
  assert false, 'inactive printer accepted';
 exception when raise_exception then
  assert sqlerrm='La impresora esta inactiva', sqlerrm;
 end;
 update public.printers set is_active=true where id=v_printer;
 begin
  perform pg_temp.test_run(gen_random_uuid(),v_printer);
  assert false, 'mixed currency accepted';
 exception when raise_exception then
  assert sqlerrm='La moneda de la tarifa de impresora no coincide con Perfil', sqlerrm;
 end;
 begin
  perform pg_temp.test_run(gen_random_uuid(),'d0900000-0000-4000-8000-000000000010');
  assert false, 'other user printer accepted';
 exception when raise_exception then
  assert sqlerrm='Impresora no encontrada', sqlerrm;
 end;
 assert (select available_weight_g=990 from public.filament_rolls), 'failed write consumed inventory';
 assert (select count(*)=1 from public.production_runs), 'failed write left a run';
 assert (select count(*)=1 from public.production_run_costs), 'failed write left costs';

 -- Null overrides explicitly use general profile rates.
 perform public.save_printer_v2(gen_random_uuid(),v_printer,'Fallback',null,null,null,null,null,null,null,true,'CRC');
 a := pg_temp.test_run(gen_random_uuid(),v_printer);
 assert (a->'costs'->>'machine_cost_per_hour')::numeric=999 and a->'costs'->>'currency'='EUR', 'general fallback failed';
 -- Existing v2 frontend still works; replay survives a profile change.
 a := public.complete_production_run_v2(v_general_request,'d0900000-0000-4000-8000-000000000030','2026-09-08',1,'completed',60,null,null,null,
 '[{"requirement_id":"d0900000-0000-4000-8000-000000000040","roll_id":"d0900000-0000-4000-8000-000000000020","grams_used":10}]','[]',30,0);
 update public.user_profiles set machine_cost_per_hour=1000 where user_id=auth.uid();
 b := pg_temp.test_run(v_general_request,null);
 assert a->'costs'=b->'costs', 'v2 replay changed cost';
 assert jsonb_array_length(public.export_my_data()->'tables'->'printers')=1, 'export missing printer';

 -- Direct inserts cannot attach another user's printer to an owned run.
 insert into public.production_runs(request_id, project_name) values(gen_random_uuid(),'RLS test') returning id into v_general_request;
 begin
  insert into public.production_run_costs(run_id,user_id,currency,printer_id)
  values(v_general_request,auth.uid(),'CRC','d0900000-0000-4000-8000-000000000010');
  assert false, 'cross-user direct FK accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_printer_v2(gen_random_uuid(),null,'Invalid',null,null,null,null,-1,1,null,true,'CRC');
  assert false, 'negative power accepted';
 exception when raise_exception then
  assert sqlerrm='La potencia promedio no es valida', sqlerrm;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','d0900000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.printers), 'other owner sees wrong printers';
 assert (select count(*)=0 from public.production_runs), 'run RLS leaked';
 assert (select count(*)=0 from public.printer_save_requests), 'request RLS leaked';
end $$;
reset role;
select 'printer safety checks passed' as result;
rollback;
