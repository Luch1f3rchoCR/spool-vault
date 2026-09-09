begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('e0900000-0000-4000-8000-000000000001','admin@example.invalid',now(),false),
 ('e0900000-0000-4000-8000-000000000002','invitee@example.invalid',now(),false),
 ('e0900000-0000-4000-8000-000000000003','stranger@example.invalid',now(),false),
 ('e0900000-0000-4000-8000-000000000004','unverified@example.invalid',null,false),
 ('e0900000-0000-4000-8000-000000000005','existing@example.invalid',now(),false);
insert into public.app_admins(user_id) values('e0900000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000001',true);
do $$
declare a public.tester_memberships; b public.tester_memberships;
begin
 a := public.reserve_tester_invitation('invitee@example.invalid','Invitee','Good test experience','Mobile use');
 b := public.reserve_tester_invitation('invitee@example.invalid','Ignored','Different reason','Different focus');
 assert a.id=b.id, 'duplicate invitation';
 assert (select reason='Good test experience' from public.tester_invitation_notes where membership_id=a.id), 'retry rewrote notes';
 perform public.reserve_tester_invitation('unverified@example.invalid','Unverified','Test verification','');
 perform public.reserve_tester_invitation('existing@example.invalid','Existing','Legacy account','');
 assert (select count(*)=3 from public.tester_welcome_deliveries), 'welcome reservations missing';
end $$;
reset role;
update public.tester_memberships set user_id='e0900000-0000-4000-8000-000000000005', activated_at='2026-09-01' where email='existing@example.invalid';
set local role authenticated;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000005',true);
do $$ begin
 assert public.get_tester_first_visit()->>'status'='active', 'legacy account asked again';
 assert (public.claim_tester_membership()).activated_at is not null, 'legacy license lost';
end $$;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000004',true);
do $$ begin
 begin
  perform public.get_tester_first_visit();
  assert false, 'unverified identity accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.complete_tester_first_visit('{}');
  assert false, 'unverified activation accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000003',true);
do $$ begin
 assert public.get_tester_first_visit()->>'status'='not_invited', 'stranger offered license';
 begin
  perform public.complete_tester_first_visit('{}');
  assert false, 'uninvited activation accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.reserve_tester_invitation('attack@example.invalid','Attack','Privilege test','');
  assert false, 'non-admin can invite';
 exception when insufficient_privilege then null; end;
 assert (select count(*)=0 from public.tester_invitation_notes), 'admin rationale leaked';
end $$;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000002',true);
do $$
declare a jsonb; b jsonb; answers jsonb; bad jsonb; member uuid;
begin
 assert public.get_tester_first_visit()->>'status'='pending', 'pending questionnaire missing';
 assert (public.claim_tester_membership()).activated_at is null, 'old frontend bypassed questionnaire';
 answers := '{"display_name":"Invitee","country":"Costa Rica","experience":"intermediate","usage":"both","purpose":"Models and products","platform":"mixed","accepted_terms":true,"printers":[{"name":"P1S","manufacturer":"Bambu Lab","model":"P1S","location":"Office"},{"name":"Ender","manufacturer":"Creality","model":"Ender 3 V2","location":"Workshop"}]}'::jsonb;
 bad := jsonb_set(answers,'{printers,1,name}','""');
 begin
  perform public.complete_tester_first_visit(bad);
  assert false, 'invalid second printer accepted';
 exception when invalid_parameter_value then null; end;
 assert (select count(*)=0 from public.printers), 'failed activation left first printer';
 assert (select count(*)=0 from public.tester_first_visits), 'failed activation left answers';
 assert public.get_tester_first_visit()->>'status'='pending', 'failed activation granted license';
 a := public.complete_tester_first_visit(answers);
 b := public.complete_tester_first_visit(answers);
 assert a=b and a->>'status'='active', 'retry changed result';
 assert jsonb_array_length(a->'printers')=2, 'wrong printer count';
 assert (select count(*)=2 from public.printers), 'retry duplicated printers';
 assert (select count(*)=1 from public.tester_first_visits), 'retry duplicated answers';
 assert (select count(*)=0 from public.tester_invitation_notes), 'admin notes leaked to invitee';
 assert public.get_tester_first_visit()->>'status'='active', 'questionnaire repeated';
 assert (public.claim_tester_membership()).activated_at is not null, 'license not readable';
 update public.printers set name='Renamed',is_active=false where name='P1S';
 b := public.complete_tester_first_visit(answers);
 assert (select count(*)=2 from public.printers), 'old onboarding retry duplicated edited printer';
 assert (select fv.answers->'printers'->0->>'name'='P1S' from public.tester_first_visits fv), 'initial answers mutated';
 assert exists(select 1 from public.printers where name='Renamed' and not is_active), 'onboarding retry overwrote profile edit';
 assert jsonb_array_length(public.export_my_data()->'tables'->'tester_first_visits')=1, 'export missing answers';
 assert not (public.export_my_data()->'tables' ? 'tester_invitation_notes'), 'export exposed admin notes';
 begin
  update public.tester_first_visits set answers='{}';
  assert false, 'invitee can overwrite initial answers';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','e0900000-0000-4000-8000-000000000001',true);
do $$ begin
 assert (select count(*)=1 from public.tester_first_visits), 'admin cannot read responses';
 assert (select count(*)=0 from public.printers), 'admin gained inventory access';
 assert (select count(*)=3 from public.tester_invitation_notes), 'admin lost rationale';
 assert jsonb_array_length(public.export_my_data()->'tables'->'tester_first_visits')=0, 'admin export includes other accounts';
end $$;
reset role;
select 'first visit checks passed' as result;
rollback;
