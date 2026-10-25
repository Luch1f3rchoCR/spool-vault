-- Tested settings, scoped to a physical roll and printer. Edits append revisions.
create table public.filament_print_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null,
  version integer not null check (version > 0),
  request_id uuid not null,
  request_values jsonb not null,
  roll_id uuid not null references public.filament_rolls(id) on delete restrict,
  printer_id uuid not null references public.printers(id) on delete restrict,
  printer_name text not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slicer text check (slicer is null or char_length(slicer) <= 120),
  nozzle_diameter_mm numeric check (nozzle_diameter_mm > 0 and nozzle_diameter_mm <= 9007199254740991),
  nozzle_temperature_c numeric check (nozzle_temperature_c >= 0 and nozzle_temperature_c <= 9007199254740991),
  bed_temperature_c numeric check (bed_temperature_c >= 0 and bed_temperature_c <= 9007199254740991),
  flow_ratio numeric check (flow_ratio > 0 and flow_ratio <= 9007199254740991),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (profile_id, version)
);
create index filament_print_profiles_owner_roll_idx on public.filament_print_profiles(user_id, roll_id, profile_id, version desc);
create index filament_print_profiles_roll_idx on public.filament_print_profiles(roll_id);
create index filament_print_profiles_printer_idx on public.filament_print_profiles(printer_id);

alter table public.filament_print_profiles enable row level security;
create policy "Owners read print settings" on public.filament_print_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Owners append print settings" on public.filament_print_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
revoke all on public.filament_print_profiles from public, anon, authenticated, service_role;
grant select, insert on public.filament_print_profiles to authenticated, service_role;

-- The trigger also protects direct API inserts; invoker RPCs never bypass RLS.
create function public.validate_filament_print_profile() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  previous public.filament_print_profiles;
  machine public.printers;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Las revisiones de impresión no se reescriben ni eliminan' using errcode = '42501';
  end if;
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  select * into previous from public.filament_print_profiles
    where profile_id = new.profile_id and user_id = new.user_id order by version desc limit 1;
  if new.version <> coalesce(previous.version, 0) + 1
    or (previous.id is not null and new.roll_id <> previous.roll_id) then
    raise exception 'El perfil cambió. Volvé a abrirlo antes de editar' using errcode = '40001';
  end if;
  if not exists (select 1 from public.filament_rolls where id = new.roll_id and user_id = new.user_id) then
    raise exception 'Filamento no disponible' using errcode = '42501';
  end if;
  select * into machine from public.printers where id = new.printer_id and user_id = new.user_id;
  if machine.id is null or (not machine.is_active and new.printer_id is distinct from previous.printer_id) then
    raise exception 'Elegí una impresora activa de tu cuenta' using errcode = '42501';
  end if;
  new.printer_name := machine.name;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.validate_filament_print_profile() from public, anon, authenticated, service_role;
create trigger filament_print_profile_guard before insert or update or delete on public.filament_print_profiles
  for each row execute function public.validate_filament_print_profile();

create view public.filament_print_profiles_current with (security_invoker = true) as
  select distinct on (user_id, profile_id) id, user_id, profile_id, version, request_id,
    roll_id, printer_id, printer_name, name, slicer, nozzle_diameter_mm,
    nozzle_temperature_c, bed_temperature_c, flow_ratio, notes, created_at
  from public.filament_print_profiles order by user_id, profile_id, version desc;
revoke all on public.filament_print_profiles_current from public, anon, authenticated, service_role;
grant select on public.filament_print_profiles_current to authenticated, service_role;

create function public.save_filament_print_profile(
  p_request_id uuid, p_profile_id uuid, p_expected_version integer, p_values jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid());
  saved public.filament_print_profiles;
  previous public.filament_print_profiles;
  operation jsonb := jsonb_build_object('profile_id', p_profile_id, 'expected_version', p_expected_version, 'values', p_values);
begin
  if owner_id is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
  if p_request_id is null or p_profile_id is null or p_expected_version is null or p_expected_version < 0
    or jsonb_typeof(p_values) is distinct from 'object' then
    raise exception 'Configuración inválida' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || p_request_id::text, 1));
  select * into saved from public.filament_print_profiles where user_id = owner_id and request_id = p_request_id;
  if found then
    if saved.request_values <> operation then
      raise exception 'No modifiqués un intento pendiente. Recuperá primero su resultado' using errcode = '22023';
    end if;
    return jsonb_build_object('profile', to_jsonb(saved) - 'request_values', 'replayed', true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));
  select * into previous from public.filament_print_profiles
    where user_id = owner_id and profile_id = p_profile_id order by version desc limit 1;
  if coalesce(previous.version, 0) <> p_expected_version then
    raise exception 'El perfil cambió. Volvé a abrirlo antes de editar' using errcode = '40001';
  end if;
  insert into public.filament_print_profiles(user_id, profile_id, version, request_id, request_values,
    roll_id, printer_id, printer_name, name, slicer, nozzle_diameter_mm, nozzle_temperature_c,
    bed_temperature_c, flow_ratio, notes)
  values (owner_id, p_profile_id, p_expected_version + 1, p_request_id, operation,
    (p_values->>'roll_id')::uuid, (p_values->>'printer_id')::uuid, '', btrim(p_values->>'name'),
    nullif(btrim(p_values->>'slicer'), ''), (p_values->>'nozzle_diameter_mm')::numeric,
    (p_values->>'nozzle_temperature_c')::numeric, (p_values->>'bed_temperature_c')::numeric,
    (p_values->>'flow_ratio')::numeric, nullif(btrim(p_values->>'notes'), '')) returning * into saved;
  return jsonb_build_object('profile', to_jsonb(saved) - 'request_values', 'replayed', false);
end;
$$;
revoke all on function public.save_filament_print_profile(uuid, uuid, integer, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_filament_print_profile(uuid, uuid, integer, jsonb) to authenticated;

-- Extend the existing export allowlist; preserve its format and existing tables.
create or replace function public.export_my_data() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_table text; v_rows jsonb; v_tables jsonb := '{}'::jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 foreach v_table in array array[
 'supplies','supply_movements','user_profiles','filament_rolls','consumption_logs','spools','spool_types','weighing_events','suppliers',
 'purchase_history','purchase_corrections','purchase_orders','purchase_order_items','purchase_order_payments',
 'print_projects','project_filament_requirements','project_components','production_runs',
 'production_run_filaments','production_run_components','production_run_costs','printers',
 'tester_memberships','user_feedback','tester_first_visits','filament_print_profiles'
 ] loop
  if to_regclass(format('public.%I',v_table)) is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r where user_id=$1',v_table)
    into v_rows using auth.uid();
   v_tables := v_tables || jsonb_build_object(v_table,v_rows);
  end if;
 end loop;
 return jsonb_build_object('format','spool-vault-account','version',1,'source','supabase',
 'exported_at',now(),'user_id',auth.uid(),'includes_binary_files',false,'tables',v_tables,
 'shared_spool_types',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.spool_types s where user_id is null));
end $$;
