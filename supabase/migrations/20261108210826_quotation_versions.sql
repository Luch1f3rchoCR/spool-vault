-- A saved version is a private snapshot. Quoting has no inventory side effects.
create table public.quotation_versions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quote_id uuid not null,
  version integer not null check (version > 0),
  request_id uuid not null,
  snapshot jsonb not null,
  total_minor bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, quote_id, version),
  unique (user_id, request_id)
);

create index quotation_versions_history_idx on public.quotation_versions(user_id, created_at desc, request_id desc);

alter table public.quotation_versions enable row level security;
create policy "Owners read quotation versions" on public.quotation_versions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners append quotation versions" on public.quotation_versions for insert to authenticated
  with check ((select auth.uid()) = user_id);
revoke all on public.quotation_versions from public, anon, authenticated, service_role;
grant select, insert on public.quotation_versions to authenticated;

create function public.validate_quotation_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  previous_version integer;
  document jsonb := new.snapshot;
  item jsonb;
  item_quantity numeric;
  unit_price numeric;
  subtotal bigint := 0;
  issued date;
  expires date;
  logo_bytes bytea;
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  -- One lock per owner's quotation writes, including direct inserts and retries.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 87122));
  select coalesce(max(q.version), 0) into previous_version from public.quotation_versions q
    where q.user_id = new.user_id and q.quote_id = new.quote_id;
  if new.version is distinct from previous_version + 1 then
    raise exception 'La cotización cambió. Abrí su versión más reciente' using errcode = '40001';
  end if;

  if jsonb_typeof(document) is distinct from 'object' or pg_column_size(document - 'seller_logo') > 65536
    or jsonb_typeof(document->'seller_name') is distinct from 'string'
    or char_length(btrim(document->>'seller_name')) not between 1 and 120
    or jsonb_typeof(document->'customer_name') is distinct from 'string'
    or char_length(btrim(document->>'customer_name')) not between 1 and 120
    or jsonb_typeof(document->'customer_contact') is distinct from 'string'
    or char_length(document->>'customer_contact') > 200
    or jsonb_typeof(document->'terms') is distinct from 'string'
    or char_length(document->>'terms') > 1500
    or (document ? 'seller_contact' and (
      jsonb_typeof(document->'seller_contact') <> 'string' or char_length(document->>'seller_contact') > 200
    ))
    or (document ? 'delivery' and (
      jsonb_typeof(document->'delivery') <> 'string' or char_length(document->>'delivery') > 300
    ))
    or (document ? 'payment_terms' and (
      jsonb_typeof(document->'payment_terms') <> 'string' or char_length(document->>'payment_terms') > 300
    ))
    or (document ? 'observations' and (
      jsonb_typeof(document->'observations') <> 'string' or char_length(document->>'observations') > 1500
    ))
    or (document ? 'seller_logo' and (
      jsonb_typeof(document->'seller_logo') <> 'string'
      or char_length(document->>'seller_logo') > 120000
      or (document->>'seller_logo') !~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$'
    ))
    or coalesce(document->>'currency', '') not in ('CRC', 'USD', 'EUR')
    or coalesce(document->>'issued_on', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(document->>'valid_until', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(document->'lines') is distinct from 'array'
    or jsonb_typeof(document->'internal_costs') is distinct from 'array' then
    raise exception 'Revisá los datos de la cotización' using errcode = '22023';
  end if;
  if document ? 'seller_logo' then
    logo_bytes := decode(split_part(document->>'seller_logo', ',', 2), 'base64');
    if octet_length(logo_bytes) < 33 or substring(logo_bytes from 9 for 8) <> decode('0000000d49484452', 'hex') then
      raise exception 'El logo debe ser un PNG válido' using errcode = '22023';
    end if;
    -- Bound the PNG dimensions before it can be loaded in a client or PDF.
    if substring(logo_bytes from 17 for 3) <> decode('000000', 'hex')
      or substring(logo_bytes from 21 for 3) <> decode('000000', 'hex')
      or get_byte(logo_bytes, 19) not between 1 and 200
      or get_byte(logo_bytes, 23) not between 1 and 100 then
      raise exception 'El logo supera el tamaño permitido' using errcode = '22023';
    end if;
  end if;
  issued := (document->>'issued_on')::date;
  expires := (document->>'valid_until')::date;
  if expires < issued or jsonb_array_length(document->'lines') not between 1 and 50
    or jsonb_array_length(document->'internal_costs') > 24 then
    raise exception 'Revisá la vigencia y las partidas de la cotización' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(document->'lines') loop
    if jsonb_typeof(item->'project_id') is distinct from 'string'
      or jsonb_typeof(item->'description') is distinct from 'string'
      or char_length(btrim(item->>'description')) not between 1 and 220
      or jsonb_typeof(item->'colors') is distinct from 'string'
      or char_length(item->>'colors') > 300
      or jsonb_typeof(item->'quantity') is distinct from 'number'
      or jsonb_typeof(item->'unit_price_minor') is distinct from 'number' then
      raise exception 'Revisá las partidas de la cotización' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.print_projects p where p.id = (item->>'project_id')::uuid and p.user_id = new.user_id
    ) then
      raise exception 'Proyecto no disponible' using errcode = '42501';
    end if;
    item_quantity := (item->>'quantity')::numeric;
    unit_price := (item->>'unit_price_minor')::numeric;
    if item_quantity not between 1 and 100000 or item_quantity <> trunc(item_quantity)
      or unit_price not between 0 and 1000000000 or unit_price <> trunc(unit_price) then
      raise exception 'Revisá la cantidad y el precio de cada partida' using errcode = '22023';
    end if;
    subtotal := subtotal + (item_quantity * unit_price)::bigint;
  end loop;

  for item in select value from jsonb_array_elements(document->'internal_costs') loop
    if coalesce(item->>'category', '') not in
      ('filament', 'supplies', 'labor', 'electricity', 'machine', 'finishing', 'packaging', 'other')
      or coalesce(item->>'currency', '') not in ('CRC', 'USD', 'EUR')
      or jsonb_typeof(item->'amount_minor') is distinct from 'number' then
      raise exception 'Revisá el desglose interno de costos' using errcode = '22023';
    end if;
    unit_price := (item->>'amount_minor')::numeric;
    if unit_price not between 0 and 1000000000 or unit_price <> trunc(unit_price) then
      raise exception 'Revisá los montos de costos internos' using errcode = '22023';
    end if;
  end loop;

  new.total_minor := subtotal;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.validate_quotation_version() from public, anon, authenticated, service_role;
create trigger quotation_version_guard before insert on public.quotation_versions
  for each row execute function public.validate_quotation_version();

create function public.save_quotation_version(
  p_request_id uuid, p_quote_id uuid, p_expected_version integer, p_snapshot jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid());
  saved public.quotation_versions;
begin
  if owner_id is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
  if p_request_id is null or p_quote_id is null or p_expected_version is null
    or p_expected_version not between 0 and 2147483646 or p_snapshot is null then
    raise exception 'Solicitud de cotización inválida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 87122));
  select * into saved from public.quotation_versions where user_id = owner_id and request_id = p_request_id;
  if found then
    if saved.quote_id <> p_quote_id or saved.version <> p_expected_version + 1 or saved.snapshot <> p_snapshot then
      raise exception 'Recuperá el intento anterior antes de guardar cambios' using errcode = '22023';
    end if;
    return to_jsonb(saved);
  end if;

  insert into public.quotation_versions (user_id, quote_id, version, request_id, snapshot, total_minor)
    values (owner_id, p_quote_id, p_expected_version + 1, p_request_id, p_snapshot, 0)
    returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_quotation_version(uuid, uuid, integer, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_quotation_version(uuid, uuid, integer, jsonb) to authenticated;

-- Preserve account export format and include only the current owner’s saved versions.
create or replace function public.export_my_data() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_table text; v_rows jsonb; v_tables jsonb:='{}';
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 foreach v_table in array array['supplies','supply_movements','user_profiles','filament_rolls','consumption_logs','spools','spool_types','weighing_events','suppliers',
 'purchase_history','purchase_corrections','purchase_orders','purchase_order_items','purchase_order_payments','print_projects','project_filament_requirements',
 'project_components','production_runs','production_run_filaments','production_run_components','production_run_costs','printers','tester_memberships',
 'user_feedback','tester_first_visits','filament_print_profiles','historical_fx_snapshots','supply_purchase_dates','quotation_versions'] loop
  if to_regclass(format('public.%I',v_table)) is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where user_id=$1',v_table) into v_rows using auth.uid();
   v_tables:=v_tables||jsonb_build_object(v_table,v_rows);
  end if;
 end loop;
 return jsonb_build_object('format','spool-vault-account','version',1,'source','supabase','exported_at',now(),'user_id',auth.uid(),
 'includes_binary_files',false,'tables',v_tables,'shared_spool_types',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.spool_types s where user_id is null));
end $$;
