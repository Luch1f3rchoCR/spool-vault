-- Synthetic fixtures. Never run against production.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('d3000000-0000-4000-8000-000000000001','catalog-owner@example.invalid',now()),
 ('d3000000-0000-4000-8000-000000000002','catalog-other@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','d3000000-0000-4000-8000-000000000001',true);
do $$
declare
 v_request uuid:=gen_random_uuid(); v_id uuid; v_result jsonb; v_bad jsonb;
 v_payload jsonb:='{"kind":"catalog","supply_id":null,"name":"Imán 6x2","category":"Imanes","unit":"unidad","currency":"CRC","tags":["Neodimio","cajas"],"description":"Para tapas\nDiámetro 6 mm"}';
begin
 v_result:=public.create_supply(v_request,v_payload);
 v_id:=(v_result->'supply'->>'id')::uuid;
 assert (v_result->'supply'->>'quantity')::numeric=0;
 assert (v_result->'supply'->>'unit_cost')::numeric=0;
 assert v_result->'movements'='[]'::jsonb;
 assert v_result->'supply'->'tags'=v_payload->'tags';
 assert v_result->'supply'->>'description'=v_payload->>'description';
 assert (public.create_supply(v_request,v_payload)->>'replayed')::boolean;
 assert (select count(*) from public.supplies)=1;
 assert (select count(*) from public.supply_movements)=0;
 assert (select count(*) from public.purchase_orders)=0;
 begin
  perform public.create_supply(v_request,v_payload||'{"description":"Changed"}');
  raise exception 'changed payload accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
 for v_bad in select value from jsonb_array_elements('[{"tags":[null]},{"tags":[1]},{"tags":null},{"tags":"wrong"},{"tags":[" "]},{"name":" "},{"description":null},{"category":"invalid"},{"currency":"invalid"},{"quantity":1},{"unit_cost":0},{"user_id":"d3000000-0000-4000-8000-000000000002"}]') loop
  begin
   perform public.create_supply(gen_random_uuid(),v_payload||v_bad);
   raise exception 'invalid accepted' using errcode='ZX001';
  exception when sqlstate 'ZX001' then raise; when check_violation or not_null_violation or sqlstate '22023' then null; end;
 end loop;
 begin
  perform public.create_supply(gen_random_uuid(),v_payload||jsonb_build_object('description',repeat('a',2001)));
  raise exception 'long description accepted' using errcode='ZX001';
 exception when check_violation then null; end;
 begin
  perform public.create_supply(gen_random_uuid(),v_payload||jsonb_build_object('tags',array[repeat('a',41)]));
  raise exception 'long tag accepted' using errcode='ZX001';
 exception when check_violation then null; end;
 begin
  perform public.create_supply(gen_random_uuid(),v_payload||jsonb_build_object('tags',array_fill('tag'::text,array[11])));
  raise exception 'too many tags accepted' using errcode='ZX001';
 exception when check_violation then null; end;
 assert (select count(*) from public.supplies)=1,'rejections leaked catalog rows';
 -- A catalog-only item can receive stock through the existing operation.
 perform public.record_supply_movement(gen_random_uuid(),jsonb_build_object('supply_id',v_id,'kind','receipt','quantity',5,'unit_cost',125,'reason','Direct entry'));
 assert (select quantity=5 and unit_cost=125 from public.supply_stock where id=v_id);
 v_result:=public.create_supply(v_request,v_payload);
 assert (v_result->'supply'->>'quantity')::numeric=5,'retry must not reset stock';
 assert jsonb_array_length(v_result->'movements')=1,'retry must return current history';
 assert (select tags=array['Neodimio','cajas'] from public.supplies where id=v_id);
 assert public.export_my_data()->'tables'->'supplies'->0->'tags'=v_payload->'tags';
 -- Optional metadata defaults, including direct inserts from older clients.
 perform public.create_supply(gen_random_uuid(),v_payload-'tags'-'description');
 assert (select count(*) from public.supplies where tags='{}' and description='')=1;
 begin
  update public.supplies set description='rewrite' where id=v_id;
  raise exception 'direct update allowed' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 -- Another user cannot see or consume these supplies, but may reuse their request UUID.
 perform set_config('request.jwt.claim.sub','d3000000-0000-4000-8000-000000000002',true);
 assert (select count(*) from public.supply_stock)=0;
 begin
  perform public.record_supply_movement(gen_random_uuid(),jsonb_build_object('supply_id',v_id,'kind','receipt','quantity',1,'unit_cost',1,'reason','Alien'));
  raise exception 'alien stock accepted' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 v_result:=public.create_supply(v_request,v_payload);
 assert (v_result->'supply'->>'id')::uuid<>v_id;
 assert (select count(*) from public.supplies)=1;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.create_supply(gen_random_uuid(),v_payload);
  raise exception 'missing session accepted' using errcode='ZX001';
 exception when sqlstate '22023' then null; end;
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.create_supply(uuid,jsonb)','execute');
 assert has_function_privilege('authenticated','public.create_supply(uuid,jsonb)','execute');
 assert not (select prosecdef from pg_proc where oid='public.create_supply(uuid,jsonb)'::regprocedure);
 assert (select 'search_path=""'=any(proconfig) from pg_proc where oid='public.create_supply(uuid,jsonb)'::regprocedure);
 assert (select relrowsecurity from pg_class where oid='public.supplies'::regclass);
 assert (select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.supply_stock'::regclass);
 assert not has_table_privilege('anon','public.supply_stock','select');
 assert not has_table_privilege('authenticated','public.supplies','update');
 assert not has_table_privilege('authenticated','public.supplies','delete');
end $$;
rollback;
