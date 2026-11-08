-- Disposable fixtures only.
begin;
insert into auth.users(id, email) values
  ('da810000-0000-4000-8000-000000000001', 'quote-owner@example.invalid'),
  ('da810000-0000-4000-8000-000000000002', 'quote-other@example.invalid');
insert into public.print_projects(id, user_id, creation_request_id, name) values
  ('da810000-0000-4000-8000-000000000011', 'da810000-0000-4000-8000-000000000001', gen_random_uuid(), 'Own project'),
  ('da810000-0000-4000-8000-000000000012', 'da810000-0000-4000-8000-000000000002', gen_random_uuid(), 'Other project');

set local role authenticated;
select set_config('request.jwt.claim.sub','da810000-0000-4000-8000-000000000001',true);
do $$
declare
  quote uuid := 'da810000-0000-4000-8000-000000000021';
  request uuid := gen_random_uuid();
  first_version public.quotation_versions;
  saved public.quotation_versions;
  logo text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  payload jsonb := '{
    "seller_name":"Taller de prueba", "customer_name":"Prueba", "customer_contact":"",
    "issued_on":"2026-11-08", "valid_until":"2026-11-30", "terms":"Condiciones",
    "currency":"CRC",
    "lines":[
      {"project_id":"da810000-0000-4000-8000-000000000011","description":"A","colors":"Verde","quantity":2,"unit_price_minor":150000},
      {"project_id":"da810000-0000-4000-8000-000000000011","description":"B","colors":"","quantity":1,"unit_price_minor":20000}
    ],
    "internal_costs":[{"category":"filament","currency":"USD","amount_minor":30}]
  }';
begin
  select * into first_version from jsonb_populate_record(null::public.quotation_versions, public.save_quotation_version(request, quote, 0, payload));
  assert first_version.version = 1 and first_version.total_minor = 320000, 'total/version mismatch';
  select * into saved from jsonb_populate_record(null::public.quotation_versions, public.save_quotation_version(request, quote, 0, payload));
  assert saved = first_version, 'retry returned a different document';

  begin
    perform public.save_quotation_version(request, quote, 0, payload || '{"terms":"changed"}');
    assert false, 'changed retry accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 0, payload);
    assert false, 'stale version accepted';
  exception when serialization_failure then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1,
      jsonb_set(payload, '{lines,1,project_id}', '"da810000-0000-4000-8000-000000000012"'));
    assert false, 'foreign project accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1,
      jsonb_set(payload, '{lines,1,unit_price_minor}', '20.5'));
    assert false, 'fractional minor units accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || '{"valid_until":"2026-11-07"}');
    assert false, 'invalid validity accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || jsonb_build_object('observations', repeat('x', 1501)));
    assert false, 'oversized observations accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || '{"seller_logo":"https://example.invalid/logo.png"}');
    assert false, 'external logo accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || '{"seller_logo":"data:image/png;base64,iVBORw0KGgoAAAAA"}');
    assert false, 'truncated PNG header accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || '{"seller_contact":1234}');
    assert false, 'non-text seller contact accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_quotation_version(gen_random_uuid(), quote, 1, payload || jsonb_build_object('delivery', repeat('x', 301)));
    assert false, 'oversized delivery details accepted';
  exception when invalid_parameter_value then null;
  end;

  assert (select count(*) from public.quotation_versions) = 1, 'rejection changed persisted versions';
  select * into saved from jsonb_populate_record(null::public.quotation_versions, public.save_quotation_version(gen_random_uuid(), quote, 1,
    jsonb_set(payload, '{lines,0,quantity}', '3') ||
    jsonb_build_object('seller_logo', logo, 'observations', 'Incluye muestra de color.')));
  assert saved.snapshot->>'seller_logo' = logo, 'logo missing from the saved version';
  assert saved.snapshot->>'observations' = 'Incluye muestra de color.', 'observations missing';
  assert saved.version = 2 and saved.total_minor = 470000, 'next version wrong';
  select * into saved from jsonb_populate_record(null::public.quotation_versions, public.save_quotation_version(request, quote, 0, payload));
  assert saved = first_version, 'old document changed after revision';
  assert jsonb_array_length(public.export_my_data()->'tables'->'quotation_versions') = 2, 'export did not include history';

  begin
    update public.quotation_versions set total_minor = 1 where quote_id = quote;
    assert false, 'update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.quotation_versions where quote_id = quote;
    assert false, 'delete allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','da810000-0000-4000-8000-000000000002',true);
do $$
begin
  assert (select count(*) from public.quotation_versions) = 0, 'another owner can read versions';
  assert public.export_my_data()->'tables'->'quotation_versions' = '[]'::jsonb, 'export leaked a quotation';
end;
$$;
set local role anon;
do $$
begin
  assert not has_table_privilege('public.quotation_versions', 'SELECT'), 'anonymous read granted';
  assert not has_function_privilege('public.save_quotation_version(uuid,uuid,integer,jsonb)', 'EXECUTE'), 'anonymous RPC granted';
end;
$$;
rollback;
