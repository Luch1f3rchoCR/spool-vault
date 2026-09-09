-- TEST ONLY: minimal Auth/Storage contracts for SQL unit tests in a disposable
-- PostgreSQL container. Does not emulate HTTP auth, emails, Storage or PostgREST.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- A historical migration revokes this Supabase helper. No event trigger is
-- installed here: every application table must explicitly enable RLS.
create function public.rls_auto_enable() returns event_trigger
language plpgsql as $$ begin return; end $$;
create schema auth;
create table auth.users (
 id uuid primary key, email text, email_confirmed_at timestamptz,
 is_anonymous boolean not null default false
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
 select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
$$;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
