begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
('c0000000-0000-4000-8000-000000000001','welcome-admin@example.invalid',now(),false),
('c0000000-0000-4000-8000-000000000002','welcome-user@example.invalid',now(),false);
insert into public.app_admins(user_id) values('c0000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
do $$ declare a public.tester_memberships; b public.tester_memberships; begin
  a := public.reserve_tester_details('welcome-user@example.invalid','Test Person','CR','Bambu P1S','ios','beginner','QR');
  b := public.reserve_tester_details('welcome-user@example.invalid','Changed Name','US','Other','android','advanced','Other');
  assert a.id=b.id and b.display_name='Test Person', 'retry changed frozen invitation';
  assert a.printers='Bambu P1S', 'contact details missing';
  assert (select count(*)=1 from public.tester_welcome_deliveries), 'duplicate delivery';
  begin
    perform public.prepare_tester_welcome(a.id,'{}'::jsonb);
    raise exception 'admin browser can prepare delivery';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
do $$ begin
  assert (select count(membership_id)=0 from public.tester_welcome_deliveries), 'nonadmin read delivery';
  begin
    perform public.reserve_tester_details('blocked@example.invalid','Blocked');
    raise exception 'nonadmin reserved invitation';
  exception when insufficient_privilege then null; end;
  begin
    update public.tester_welcome_deliveries set status='accepted';
    raise exception 'client forged accepted status';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare v_id uuid; a public.tester_welcome_deliveries; b public.tester_welcome_deliveries; begin
  select id into v_id from public.tester_memberships where email='welcome-user@example.invalid';
  begin
    perform public.prepare_tester_welcome(v_id,'{"to":["wrong@example.invalid"]}'::jsonb);
    raise exception 'wrong recipient accepted';
  exception when raise_exception then
    if sqlerrm='wrong recipient accepted' then raise; end if;
  end;
  a := public.prepare_tester_welcome(v_id,'{"to":["welcome-user@example.invalid"],"text":"Original"}'::jsonb);
  b := public.prepare_tester_welcome(v_id,'{"to":["welcome-user@example.invalid"],"text":"Changed"}'::jsonb);
  assert a.first_attempt_at=b.first_attempt_at and a.payload=b.payload, 'retry changed provider payload';
  assert a.status='sending', 'delivery not prepared';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
do $$ declare v_id uuid; begin
  select id into v_id from public.tester_memberships where email='welcome-user@example.invalid';
  begin
    perform public.cancel_tester_invitation(v_id);
    raise exception 'cancelled after delivery started';
  exception when raise_exception then
    if sqlerrm='cancelled after delivery started' then raise; end if;
  end;
end $$;
rollback;
