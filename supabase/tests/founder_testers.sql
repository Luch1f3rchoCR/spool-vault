begin;
-- Temporary identities and fixtures are always rolled back.
insert into auth.users(id, email, email_confirmed_at, is_anonymous)
values
 ('a0000000-0000-4000-8000-000000000001', 'sv-admin@example.invalid', now(), false),
 ('a0000000-0000-4000-8000-000000000002', 'sv-tester@example.invalid', now(), false),
 ('a0000000-0000-4000-8000-000000000003', 'sv-other@example.invalid', now(), false),
 ('a0000000-0000-4000-8000-000000000004', 'sv-unverified@example.invalid', null, false);
insert into public.app_admins(user_id) values ('a0000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
do $$
declare a public.tester_memberships; b public.tester_memberships;
begin
  a := public.reserve_tester(' SV-TESTER@example.invalid ', 'Tester');
  b := public.reserve_tester('sv-tester@example.invalid', 'Tester');
  assert a.id = b.id, 'retry duplicated membership';
  perform public.reserve_tester('sv-unverified@example.invalid', '');
  a := public.reserve_tester('sv-cancel@example.invalid', '');
  perform public.cancel_tester_invitation(a.id);
  perform public.cancel_tester_invitation(a.id);
  assert (select cancelled_at is not null from public.tester_memberships where id=a.id), 'cancellation missing';
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
do $$
declare m public.tester_memberships;
begin
  m := public.claim_tester_membership();
  assert m.id is null, 'unverified email claimed benefit';
  begin
    perform public.submit_feedback(gen_random_uuid(), 'idea', 'Test idea', 'Test details long enough');
    raise exception 'unverified feedback accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
do $$
declare a public.tester_memberships; b public.tester_memberships; f public.user_feedback;
begin
  a := public.claim_tester_membership();
  b := public.claim_tester_membership();
  assert a.id is not null and a.id = b.id and a.activated_at = b.activated_at, 'claim not idempotent';
  assert (select count(*)=1 from public.tester_memberships), 'membership RLS leaked';
  assert (select count(*)=0 from public.app_admins), 'admin RLS leaked';
  begin
    perform public.reserve_tester('sv-attacker@example.invalid', '');
    raise exception 'non-admin grant accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_admins(user_id) values (auth.uid());
    raise exception 'self admin promotion accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.tester_memberships set plan_code='founder_personal_v1' where user_id=auth.uid();
    raise exception 'membership writable';
  exception when insufficient_privilege then null; end;
  f := public.submit_feedback('b0000000-0000-4000-8000-000000000001', 'bug', 'Test bug', 'Steps and expected result');
  perform public.submit_feedback(f.id, 'bug', 'Test bug', 'Steps and expected result');
  assert (select count(*)=1 from public.user_feedback), 'feedback retry duplicated';
  begin
    perform public.submit_feedback(f.id, 'idea', 'Test bug', 'Steps and expected result');
    raise exception 'mismatched retry accepted';
  exception when invalid_parameter_value then null; end;
  update public.user_feedback set status='resolved' where id=f.id;
  assert (select status='received' from public.user_feedback where id=f.id), 'user can edit status';
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
do $$ begin
  assert (select count(*)=0 from public.user_feedback), 'feedback RLS leaked';
  assert jsonb_array_length(public.export_my_data()->'tables'->'tester_memberships')=0, 'export leaked memberships';
  begin
    perform public.submit_feedback('b0000000-0000-4000-8000-000000000001', 'bug', 'Test bug', 'Steps and expected result');
    raise exception 'cross-user retry accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid;
begin
  select id into v_id from public.tester_memberships where email='sv-tester@example.invalid';
  begin
    perform public.cancel_tester_invitation(v_id);
    raise exception 'active lifetime grant cancelled';
  exception when raise_exception then
    if sqlerrm = 'active lifetime grant cancelled' then raise; end if;
  end;
  update public.user_feedback set status='reviewing', admin_reply='Investigando'
    where id='b0000000-0000-4000-8000-000000000001';
  assert (select status='reviewing' from public.user_feedback where id='b0000000-0000-4000-8000-000000000001'), 'admin review failed';
  assert jsonb_array_length(public.export_my_data()->'tables'->'user_feedback')=0, 'admin export included other accounts';
end $$;
reset role;
insert into public.user_feedback(id,user_id,kind,title,details)
select gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'idea', 'Bulk export test', 'More than the API row limit'
from generate_series(1,1001);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
do $$ begin
  assert jsonb_array_length(public.export_my_data()->'tables'->'user_feedback')=1002, 'export truncated at API limit';
  begin
    perform public.submit_feedback(gen_random_uuid(), 'idea', 'Another idea', 'More details to test the daily limit');
    raise exception 'daily limit bypassed';
  exception when raise_exception then
    if sqlerrm='daily limit bypassed' then raise; end if;
  end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.export_my_data();
    raise exception 'anonymous export accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_tester_membership();
    raise exception 'anonymous claim accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
