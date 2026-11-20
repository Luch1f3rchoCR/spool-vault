alter table public.tester_memberships
  add column founder_granted_at timestamptz,
  add column founder_granted_by uuid references auth.users(id) on delete set null;

-- Preserve access already awarded under the original program.
update public.tester_memberships
set founder_granted_at = activated_at
where activated_at is not null;

alter table public.tester_memberships
  add constraint founder_grant_requires_activation check (
    (founder_granted_at is null or (
      activated_at is not null and cancelled_at is null and founder_granted_at >= activated_at
    )) and (founder_granted_by is null or founder_granted_at is not null)
  );

create function private.grant_tester_founder_personal(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_member public.tester_memberships;
begin
  if v_admin is null or not private.is_app_admin() then
    raise exception 'Solo administración puede otorgar Founder Personal.' using errcode = '42501';
  end if;

  select * into v_member from public.tester_memberships where id = p_id for update;
  if not found or v_member.activated_at is null or v_member.cancelled_at is not null then
    raise exception 'El piloto no está activo.' using errcode = '22023';
  end if;
  if v_member.founder_granted_at is not null then
    return v_member.founder_granted_at;
  end if;
  if v_member.user_id is null or v_member.activated_at + interval '336 hours' > now() then
    raise exception 'La cuenta debe completar los 14 días del piloto.' using errcode = '22023';
  end if;

  update public.tester_memberships
  set founder_granted_at = now(), founder_granted_by = v_admin
  where id = p_id
  returning founder_granted_at into v_member.founder_granted_at;
  return v_member.founder_granted_at;
end $$;

create function public.grant_tester_founder_personal(p_id uuid)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.grant_tester_founder_personal(p_id) $$;

revoke all on function private.grant_tester_founder_personal(uuid),
  public.grant_tester_founder_personal(uuid) from public, anon;
grant execute on function private.grant_tester_founder_personal(uuid),
  public.grant_tester_founder_personal(uuid) to authenticated;
