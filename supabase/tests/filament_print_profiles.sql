-- Disposable fixtures only. Success, rejection, replay, versioning and isolation.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('da250000-0000-4000-8000-000000000001','print-owner@example.invalid',now()),
 ('da250000-0000-4000-8000-000000000002','print-other@example.invalid',now());
insert into public.printers(id,user_id,creation_request_id,name) values
 ('da250000-0000-4000-8000-000000000011','da250000-0000-4000-8000-000000000001',gen_random_uuid(),'Own printer'),
 ('da250000-0000-4000-8000-000000000012','da250000-0000-4000-8000-000000000002',gen_random_uuid(),'Other printer');
insert into public.filament_rolls(id,user_id,brand,material,color_name,color_hex,initial_weight_g,available_weight_g) values
 ('da250000-0000-4000-8000-000000000021','da250000-0000-4000-8000-000000000001','Test','PLA','Test','#FFFFFF',1000,800),
 ('da250000-0000-4000-8000-000000000022','da250000-0000-4000-8000-000000000002','Test','PLA','Test','#FFFFFF',1000,900);
set local role authenticated;
select set_config('request.jwt.claim.sub','da250000-0000-4000-8000-000000000001',true);
do $$
declare
  request uuid := gen_random_uuid(); profile uuid := gen_random_uuid(); edit_request uuid := gen_random_uuid();
  payload jsonb := '{"roll_id":"da250000-0000-4000-8000-000000000021","printer_id":"da250000-0000-4000-8000-000000000011","name":"PLA probado","nozzle_diameter_mm":0.4,"nozzle_temperature_c":220,"bed_temperature_c":0,"flow_ratio":0.98,"notes":"Prueba"}';
  first_result jsonb; result jsonb; invalid jsonb;
begin
  first_result := public.save_filament_print_profile(request,profile,0,payload);
  result := public.save_filament_print_profile(request,profile,0,payload);
  assert (result->>'replayed')::boolean and result->'profile'=first_result->'profile','create retry changed result';
  assert (result->'profile'->>'version')::integer=1,'first version';
  assert result->'profile'->'slicer'='null'::jsonb,'unknown became a value';
  assert (result->'profile'->>'bed_temperature_c')::numeric=0,'zero became unknown';
  begin
    perform public.save_filament_print_profile(request,profile,0,payload || '{"name":"changed"}');
    assert false,'changed retry accepted';
  exception when invalid_parameter_value then null; end;
  result := public.save_filament_print_profile(edit_request,profile,1,payload || '{"nozzle_temperature_c":225}');
  assert (result->'profile'->>'version')::integer=2,'edit did not append';
  assert (select count(*)=2 from public.filament_print_profiles),'history overwritten';
  assert (select count(*)=1 from public.filament_print_profiles_current),'multiple current versions';
  assert (select nozzle_temperature_c=220 from public.filament_print_profiles where version=1),'old settings changed';
  result := public.save_filament_print_profile(request,profile,0,payload);
  assert result->'profile'=first_result->'profile','old retry returns new state';
  assert (select version=2 from public.filament_print_profiles_current),'old retry reverted edit';
  begin
    perform public.save_filament_print_profile(gen_random_uuid(),profile,1,payload);
    assert false,'stale edit accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_filament_print_profile(gen_random_uuid(),gen_random_uuid(),0,payload || '{"printer_id":"da250000-0000-4000-8000-000000000012"}');
    assert false,'foreign printer accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_filament_print_profile(gen_random_uuid(),gen_random_uuid(),0,payload || '{"roll_id":"da250000-0000-4000-8000-000000000022"}');
    assert false,'foreign roll accepted';
  exception when insufficient_privilege then null; end;
  foreach invalid in array array['{"flow_ratio":0}'::jsonb,'{"nozzle_diameter_mm":-1}'::jsonb,'{"nozzle_temperature_c":-1}'::jsonb,'{"bed_temperature_c":"NaN"}'::jsonb,'{"flow_ratio":"Infinity"}'::jsonb,'{"name":"   "}'::jsonb] loop
    begin
      perform public.save_filament_print_profile(gen_random_uuid(),gen_random_uuid(),0,payload || invalid);
      assert false,'invalid field accepted';
    exception when check_violation then null; end;
  end loop;
  update public.printers set is_active=false where id='da250000-0000-4000-8000-000000000011';
  begin
    perform public.save_filament_print_profile(gen_random_uuid(),gen_random_uuid(),0,payload);
    assert false,'inactive printer accepted for new profile';
  exception when insufficient_privilege then null; end;
  perform public.save_filament_print_profile(gen_random_uuid(),profile,2,payload);
  assert (select count(*)=3 from public.filament_print_profiles),'existing inactive printer lost its configuration';
  begin
    update public.filament_print_profiles set name='overwrite'; assert false,'history update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.filament_print_profiles; assert false,'history deletion allowed';
  exception when insufficient_privilege then null; end;
  assert (select available_weight_g=800 from public.filament_rolls),'settings changed stock';
  assert jsonb_array_length(public.export_my_data()->'tables'->'filament_print_profiles')=3,'export lost revisions';
end;
$$;
select set_config('request.jwt.claim.sub','da250000-0000-4000-8000-000000000002',true);
do $$ begin
  assert (select count(*)=0 from public.filament_print_profiles),'RLS exposed revisions';
  assert (select count(*)=0 from public.filament_print_profiles_current),'view bypassed RLS';
  assert jsonb_array_length(public.export_my_data()->'tables'->'filament_print_profiles')=0,'export exposed foreign revisions';
end $$;
reset role;
do $$ begin
  assert not has_table_privilege('anon','public.filament_print_profiles','SELECT'),'anonymous reads allowed';
  assert not has_function_privilege('anon','public.save_filament_print_profile(uuid,uuid,integer,jsonb)','EXECUTE'),'anonymous writes allowed';
  assert not has_table_privilege('authenticated','public.filament_print_profiles','UPDATE'),'mutable history';
  assert not has_table_privilege('service_role','public.filament_print_profiles','DELETE'),'destructive inherited grant';
end $$;
rollback;
