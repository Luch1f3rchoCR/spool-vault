alter table public.tester_memberships
  add column country text not null default '' check (char_length(country) <= 80),
  add column printers text not null default '' check (char_length(printers) <= 300),
  add column platform text not null default 'unspecified' check (platform in ('unspecified','ios','android','desktop','mixed')),
  add column experience text not null default 'unspecified' check (experience in ('unspecified','beginner','intermediate','advanced')),
  add column testing_focus text not null default '' check (char_length(testing_focus) <= 1000);

create table public.tester_welcome_deliveries (
  membership_id uuid primary key references public.tester_memberships(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','accepted','uncertain','review_required')),
  first_attempt_at timestamptz,
  accepted_at timestamptz,
  provider_message_id text,
  payload jsonb,
  check ((first_attempt_at is null) = (payload is null)),
  check (status <> 'accepted' or (accepted_at is not null and provider_message_id is not null))
);
alter table public.tester_welcome_deliveries enable row level security;
revoke all on public.tester_welcome_deliveries from public, anon, authenticated;
grant select(membership_id, status, first_attempt_at, accepted_at) on public.tester_welcome_deliveries to authenticated;
grant select, update on public.tester_welcome_deliveries to service_role;
grant select on public.tester_memberships to service_role;
create policy welcome_admin_read on public.tester_welcome_deliveries for select to authenticated
using ((select private.is_app_admin()));

create function private.reserve_tester_details(
  p_email text, p_name text, p_country text, p_printers text,
  p_platform text, p_experience text, p_testing_focus text
) returns public.tester_memberships
language plpgsql security definer set search_path = ''
as $$
declare v_member public.tester_memberships;
begin
  if auth.uid() is null or not private.is_app_admin() then
    raise exception 'Solo el administrador puede agregar probadores.' using errcode='42501';
  end if;
  if char_length(btrim(p_name)) < 2 then raise exception 'Escribi el nombre del probador.'; end if;
  -- The unique email and this transaction make retries atomic across both tables.
  insert into public.tester_memberships(email, display_name, granted_by, country, printers, platform, experience, testing_focus)
    values (lower(btrim(p_email)), btrim(p_name), auth.uid(), btrim(p_country),
      btrim(p_printers), p_platform, p_experience, btrim(p_testing_focus))
    on conflict (email) do nothing returning * into v_member;
  if v_member.id is null then
    select * into v_member from public.tester_memberships where email=lower(btrim(p_email));
  end if;
  insert into public.tester_welcome_deliveries(membership_id) values(v_member.id)
    on conflict (membership_id) do nothing;
  return v_member;
end $$;
revoke all on function private.reserve_tester_details(text,text,text,text,text,text,text) from public, anon;
grant execute on function private.reserve_tester_details(text,text,text,text,text,text,text) to authenticated;
create function public.reserve_tester_details(
  p_email text, p_name text, p_country text default '', p_printers text default '',
  p_platform text default 'unspecified', p_experience text default 'unspecified', p_testing_focus text default ''
) returns public.tester_memberships
language sql security invoker set search_path = ''
as $$ select private.reserve_tester_details(p_email,p_name,p_country,p_printers,p_platform,p_experience,p_testing_focus) $$;
revoke all on function public.reserve_tester_details(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.reserve_tester_details(text,text,text,text,text,text,text) to authenticated;

-- Only the trusted mail endpoint may freeze or acknowledge an email.
create function public.prepare_tester_welcome(p_id uuid, p_payload jsonb)
returns public.tester_welcome_deliveries
language plpgsql security invoker set search_path = ''
as $$
declare v_member public.tester_memberships; v_delivery public.tester_welcome_deliveries;
begin
  select * into v_member from public.tester_memberships where id=p_id for update;
  if v_member.id is null or v_member.cancelled_at is not null then
    raise exception 'Invitacion cancelada o inexistente.';
  end if;
  select * into v_delivery from public.tester_welcome_deliveries where membership_id=p_id for update;
  if v_delivery.membership_id is null then raise exception 'Primero guarda los datos de la invitacion.'; end if;
  if v_delivery.first_attempt_at is null then
    if p_payload->'to' <> jsonb_build_array(v_member.email) or p_payload->'to' is null then
      raise exception 'El destinatario no coincide con la invitacion.';
    end if;
    update public.tester_welcome_deliveries set payload=p_payload, first_attempt_at=now(), status='sending'
      where membership_id=p_id returning * into v_delivery;
  end if;
  return v_delivery;
end $$;
revoke all on function public.prepare_tester_welcome(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.prepare_tester_welcome(uuid,jsonb) to service_role;
-- SELECT FOR UPDATE requires UPDATE privilege even though the license is unchanged.
grant update(id) on public.tester_memberships to service_role;

create or replace function private.cancel_tester_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_app_admin() then
    raise exception 'Solo el administrador puede cancelar invitaciones.' using errcode='42501';
  end if;
  perform 1 from public.tester_memberships where id=p_id for update;
  if exists (select 1 from public.tester_welcome_deliveries where membership_id=p_id and first_attempt_at is not null) then
    raise exception 'La bienvenida ya inicio su envio; revisala antes de cancelar.';
  end if;
  update public.tester_memberships set cancelled_at=coalesce(cancelled_at,now()) where id=p_id and activated_at is null;
  if not found then raise exception 'La membresia ya esta activa o no existe.'; end if;
end $$;
