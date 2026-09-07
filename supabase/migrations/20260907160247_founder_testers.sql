-- Founder access is independent from the user-editable profile.
create schema if not exists private;

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon, authenticated;
grant select on public.app_admins to authenticated;
create policy admin_self_read on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_app_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select auth.uid() is not null and exists (
  select 1 from public.app_admins where user_id = auth.uid()
) $$;
revoke all on function private.is_app_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_app_admin() to authenticated;

create table public.tester_memberships (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    email = lower(btrim(email)) and char_length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  display_name text not null default '' check (char_length(display_name) <= 120),
  user_id uuid unique references auth.users(id) on delete set null,
  plan_code text not null default 'founder_personal_v1' check (plan_code = 'founder_personal_v1'),
  terms_version text not null default 'founder-v1' check (terms_version = 'founder-v1'),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  check (cancelled_at is null or activated_at is null)
);
create index tester_memberships_granted_by_idx on public.tester_memberships(granted_by);
alter table public.tester_memberships enable row level security;
revoke all on public.tester_memberships from public, anon, authenticated;
grant select on public.tester_memberships to authenticated;
create policy membership_read on public.tester_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_app_admin()));

create table public.user_feedback (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('idea', 'bug')),
  title text not null check (char_length(btrim(title)) between 4 and 160),
  details text not null check (char_length(btrim(details)) between 10 and 5000),
  status text not null default 'received' check (status in ('received', 'reviewing', 'planned', 'resolved')),
  admin_reply text not null default '' check (char_length(admin_reply) <= 2000),
  created_at timestamptz not null default now()
);
create index user_feedback_user_created_idx on public.user_feedback(user_id, created_at);
alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from public, anon, authenticated;
grant select on public.user_feedback to authenticated;
grant update(status, admin_reply) on public.user_feedback to authenticated;
create policy feedback_read on public.user_feedback for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_app_admin()));
create policy feedback_admin_update on public.user_feedback for update to authenticated
using ((select private.is_app_admin())) with check ((select private.is_app_admin()));

-- Privileged operations stay in a non-exposed schema and check the caller.
create function private.reserve_tester(p_email text, p_name text)
returns public.tester_memberships language plpgsql security definer set search_path = ''
as $$
declare v_row public.tester_memberships;
begin
  if auth.uid() is null or not private.is_app_admin() then
    raise exception 'Solo el administrador puede agregar probadores.' using errcode = '42501';
  end if;
  insert into public.tester_memberships(email, display_name, granted_by)
  values (lower(btrim(p_email)), btrim(coalesce(p_name, '')), auth.uid())
  on conflict (email) do nothing returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.tester_memberships where email = lower(btrim(p_email));
  end if;
  return v_row;
end $$;

create function private.claim_tester_membership()
returns public.tester_memberships language plpgsql security definer set search_path = ''
as $$
declare v_email text; v_row public.tester_memberships;
begin
  if auth.uid() is null then raise exception 'Inicia sesion.' using errcode = '42501'; end if;
  -- Read the current verified identity, never a user-editable metadata claim.
  select lower(email) into v_email from auth.users
    where id = auth.uid() and email_confirmed_at is not null and not is_anonymous;
  if v_email is null then return null; end if;
  select * into v_row from public.tester_memberships where user_id = auth.uid();
  if v_row.id is not null then return v_row; end if;
  update public.tester_memberships
    set user_id = auth.uid(), activated_at = now()
    where email = v_email and user_id is null and activated_at is null and cancelled_at is null
    returning * into v_row;
  return v_row;
end $$;

create function private.cancel_tester_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_app_admin() then
    raise exception 'Solo el administrador puede cancelar invitaciones.' using errcode = '42501';
  end if;
  update public.tester_memberships set cancelled_at = coalesce(cancelled_at, now())
    where id = p_id and activated_at is null;
  if not found then raise exception 'La membresia ya esta activa o no existe.'; end if;
end $$;

create function private.submit_feedback(p_id uuid, p_kind text, p_title text, p_details text)
returns public.user_feedback language plpgsql security definer set search_path = ''
as $$
declare v_row public.user_feedback;
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null and not is_anonymous
  ) then raise exception 'Inicia sesion con tu correo verificado.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 731));
  select * into v_row from public.user_feedback where id = p_id;
  if v_row.id is not null then
    if v_row.user_id <> auth.uid() or v_row.kind <> p_kind
      or v_row.title <> btrim(p_title) or v_row.details <> btrim(p_details) then
      raise exception 'Este envio no coincide con el original.' using errcode = '22023';
    end if;
    return v_row;
  end if;
  if (select count(*) from public.user_feedback where user_id = auth.uid()
    and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Llegaste al limite de 20 aportes diarios. Intenta de nuevo manana.';
  end if;
  insert into public.user_feedback(id, user_id, kind, title, details)
    values (p_id, auth.uid(), p_kind, btrim(p_title), btrim(p_details)) returning * into v_row;
  return v_row;
end $$;

revoke all on function private.reserve_tester(text, text) from public, anon;
revoke all on function private.claim_tester_membership() from public, anon;
revoke all on function private.cancel_tester_invitation(uuid) from public, anon;
revoke all on function private.submit_feedback(uuid, text, text, text) from public, anon;
grant execute on function private.reserve_tester(text, text),
  private.claim_tester_membership(), private.cancel_tester_invitation(uuid),
  private.submit_feedback(uuid, text, text, text) to authenticated;

create function public.reserve_tester(p_email text, p_name text default '')
returns public.tester_memberships language sql security invoker set search_path = ''
as $$ select private.reserve_tester(p_email, p_name) $$;
create function public.claim_tester_membership()
returns public.tester_memberships language sql security invoker set search_path = ''
as $$ select private.claim_tester_membership() $$;
create function public.cancel_tester_invitation(p_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.cancel_tester_invitation(p_id) $$;
create function public.submit_feedback(p_id uuid, p_kind text, p_title text, p_details text)
returns public.user_feedback language sql security invoker set search_path = ''
as $$ select private.submit_feedback(p_id, p_kind, p_title, p_details) $$;
revoke all on function public.reserve_tester(text, text), public.claim_tester_membership(),
  public.cancel_tester_invitation(uuid), public.submit_feedback(uuid, text, text, text) from public, anon;
grant execute on function public.reserve_tester(text, text), public.claim_tester_membership(),
  public.cancel_tester_invitation(uuid), public.submit_feedback(uuid, text, text, text) to authenticated;

-- STABLE reads share the calling statement's snapshot. The fixed allowlist
-- also supports databases where the additive printers module is not installed.
create function public.export_my_data() returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare v_table text; v_rows jsonb; v_tables jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesion.' using errcode = '42501'; end if;
  foreach v_table in array array[
    'user_profiles', 'filament_rolls', 'consumption_logs', 'spools', 'spool_types', 'weighing_events', 'suppliers', 'purchase_history', 'purchase_corrections', 'purchase_orders', 'purchase_order_items', 'purchase_order_payments', 'print_projects', 'project_filament_requirements', 'project_components', 'production_runs', 'production_run_filaments', 'production_run_components', 'production_run_costs', 'printers', 'tester_memberships', 'user_feedback'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r where user_id = $1', v_table)
        into v_rows using auth.uid();
      v_tables := v_tables || jsonb_build_object(v_table, v_rows);
    end if;
  end loop;
  return jsonb_build_object(
    'format', 'spool-vault-account', 'version', 1, 'source', 'supabase',
    'exported_at', now(), 'user_id', auth.uid(), 'includes_binary_files', false,
    'tables', v_tables,
    'shared_spool_types', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      from public.spool_types s where s.user_id is null)
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

comment on table public.tester_memberships is
  'Founder personal v1 lifetime grant. No expiry or recurring payment. Independent of editable profile membership_status.';
