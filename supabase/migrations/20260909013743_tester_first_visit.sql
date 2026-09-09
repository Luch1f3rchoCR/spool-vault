-- First visit for NEW founder activations. Existing active members keep access.
create table public.tester_first_visits (
  membership_id uuid primary key references public.tester_memberships(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  answers jsonb not null,
  completed_at timestamptz not null default now()
);
alter table public.tester_first_visits enable row level security;
revoke all on public.tester_first_visits from public, anon, authenticated;
grant select on public.tester_first_visits to authenticated;
create policy first_visit_read on public.tester_first_visits for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_app_admin()));

-- Invitation rationale is admin-only; never mixed with the invitee's answers.
create table public.tester_invitation_notes (
  membership_id uuid primary key references public.tester_memberships(id) on delete cascade,
  reason text not null check(char_length(btrim(reason)) between 3 and 1000),
  expected_focus text not null default '' check(char_length(expected_focus)<=1000)
);
alter table public.tester_invitation_notes enable row level security;
revoke all on public.tester_invitation_notes from public, anon, authenticated;
grant select on public.tester_invitation_notes to authenticated;
create policy invitation_notes_admin_read on public.tester_invitation_notes for select to authenticated
using ((select private.is_app_admin()));

create function private.reserve_tester_invitation(p_email text,p_name text,p_reason text,p_expected_focus text)
returns public.tester_memberships language plpgsql security definer set search_path=''
as $$
declare v_member public.tester_memberships;
begin
 if auth.uid() is null or not private.is_app_admin() then raise exception 'Solo administracion' using errcode='42501'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 1000 then raise exception 'Indica el motivo de la invitacion' using errcode='22023'; end if;
 v_member := private.reserve_tester_details(p_email,p_name,'','','unspecified','unspecified','');
 insert into public.tester_invitation_notes(membership_id,reason,expected_focus)
 values(v_member.id,btrim(p_reason),btrim(coalesce(p_expected_focus,'')))
 on conflict(membership_id) do nothing;
 return v_member;
end $$;
create function public.reserve_tester_invitation(p_email text,p_name text,p_reason text,p_expected_focus text)
returns public.tester_memberships language sql security invoker set search_path=''
as $$ select private.reserve_tester_invitation(p_email,p_name,p_reason,p_expected_focus) $$;

-- The old frontend may still call claim. It must not skip the questionnaire.
create or replace function private.claim_tester_membership()
returns public.tester_memberships language plpgsql security definer set search_path=''
as $$
declare v_row public.tester_memberships;
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 select m.* into v_row from public.tester_memberships m
 join auth.users u on u.id=m.user_id
 where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
 and m.activated_at is not null and m.cancelled_at is null;
 return v_row;
end $$;

create function private.get_tester_first_visit()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_email text; v_member public.tester_memberships;
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users
 where id=auth.uid() and email_confirmed_at is not null and not is_anonymous;
 if v_email is null then raise exception 'Verifica tu correo.' using errcode='42501'; end if;
 select * into v_member from public.tester_memberships
 where cancelled_at is null and (user_id=auth.uid() or (user_id is null and email=v_email and activated_at is null))
 order by (user_id is not null) desc limit 1;
 if not found then return jsonb_build_object('status','not_invited'); end if;
 if v_member.activated_at is not null then return jsonb_build_object('status','active'); end if;
 return jsonb_build_object('status','pending','display_name',v_member.display_name);
end $$;
create function public.get_tester_first_visit()
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_tester_first_visit() $$;

create function private.complete_tester_first_visit(p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid := auth.uid(); v_email text; v_member public.tester_memberships;
 v_printer jsonb; v_printers jsonb; v_currency text; v_name text;
begin
 if v_user is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users
 where id=v_user and email_confirmed_at is not null and not is_anonymous;
 if v_email is null then raise exception 'Verifica tu correo.' using errcode='42501'; end if;
 select * into v_member from public.tester_memberships
 where cancelled_at is null and (user_id=v_user or (user_id is null and email=v_email and activated_at is null))
 order by (user_id is not null) desc limit 1
 for update;
 if not found then raise exception 'Invitacion no disponible' using errcode='42501'; end if;
 -- The membership lock serializes retries, including a lost browser response.
 -- Never recreate printers or overwrite initial answers after activation.
 if v_member.activated_at is null then
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>30000 then
   raise exception 'Respuestas no validas' using errcode='22023';
  end if;
  v_name := btrim(p_answers->>'display_name');
  if v_name is null or char_length(v_name) not between 2 and 120
   or coalesce(p_answers->>'experience','') not in ('beginner','intermediate','advanced')
   or coalesce(p_answers->>'usage','') not in ('hobby','professional','both')
   or coalesce(p_answers->>'platform','') not in ('ios','android','desktop','mixed')
   or coalesce(char_length(btrim(p_answers->>'purpose')),0) not between 3 and 1000
   or coalesce(char_length(p_answers->>'country'),0)>80
   or (p_answers->'accepted_terms') is distinct from 'true'::jsonb
   or (jsonb_typeof(p_answers->'printers')) is distinct from 'array' then
   raise exception 'Completa las respuestas requeridas' using errcode='22023';
  end if;
  if jsonb_array_length(p_answers->'printers')>20 then raise exception 'Demasiadas impresoras' using errcode='22023'; end if;
  select coalesce(production_cost_currency,base_currency,'CRC') into v_currency
   from public.user_profiles where user_id=v_user;
  v_currency := coalesce(v_currency,'CRC');
  for v_printer in select value from jsonb_array_elements(p_answers->'printers') loop
   if jsonb_typeof(v_printer)<>'object' or coalesce(char_length(btrim(v_printer->>'name')),0) not between 1 and 120 then
    raise exception 'Nombre de impresora requerido' using errcode='22023';
   end if;
   -- Only allow explicit descriptive fields. No user IDs, tariffs, API keys
   -- or integration settings are trusted from the questionnaire payload.
   insert into public.printers(user_id,creation_request_id,name,manufacturer,model,location,machine_cost_currency)
   values(v_user,gen_random_uuid(),btrim(v_printer->>'name'),nullif(btrim(v_printer->>'manufacturer'),''),
    nullif(btrim(v_printer->>'model'),''),nullif(btrim(v_printer->>'location'),''),v_currency);
  end loop;
  insert into public.tester_first_visits(membership_id,user_id,answers)
   values(v_member.id,v_user,p_answers);
  insert into public.user_profiles(user_id,display_name) values(v_user,v_name)
   on conflict(user_id) do update set display_name=excluded.display_name;
  update public.tester_memberships set user_id=v_user,activated_at=now() where id=v_member.id;
 end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at,p.id),'[]'::jsonb) into v_printers
 from public.printers p where p.user_id=v_user;
 return jsonb_build_object('status','active','printers',v_printers);
end $$;
create function public.complete_tester_first_visit(p_answers jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select private.complete_tester_first_visit(p_answers) $$;

revoke all on function private.reserve_tester_invitation(text,text,text,text),
 private.get_tester_first_visit(),private.complete_tester_first_visit(jsonb),
 public.reserve_tester_invitation(text,text,text,text),public.get_tester_first_visit(),
 public.complete_tester_first_visit(jsonb) from public,anon;
grant execute on function private.reserve_tester_invitation(text,text,text,text),
 private.get_tester_first_visit(),private.complete_tester_first_visit(jsonb),
 public.reserve_tester_invitation(text,text,text,text),public.get_tester_first_visit(),
 public.complete_tester_first_visit(jsonb) to authenticated;

-- Keep the consistent account export, adding the caller's first-visit answers.
create or replace function public.export_my_data() returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare v_table text; v_rows jsonb; v_tables jsonb := '{}'::jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 foreach v_table in array array[
 'user_profiles','filament_rolls','consumption_logs','spools','spool_types','weighing_events','suppliers',
 'purchase_history','purchase_corrections','purchase_orders','purchase_order_items','purchase_order_payments',
 'print_projects','project_filament_requirements','project_components','production_runs',
 'production_run_filaments','production_run_components','production_run_costs','printers',
 'tester_memberships','user_feedback','tester_first_visits'
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
