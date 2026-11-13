-- Local stand-in for the parts of Supabase the migrations rely on, so the tests run on plain PostgreSQL.
-- Never run this on the real Supabase project (it already has these).
--   createdb hamlaty_test && psql -d hamlaty_test -f supabase/tests/_supabase_stub.sql \
--     -f supabase/migrations/0001_init.sql -f supabase/tests/rls_test.sql
\set ON_ERROR_STOP 1
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, phone text);
grant usage on schema auth to anon, authenticated, service_role;

-- Tests pick the user with set_config('request.jwt.claim.sub', …) and the sign-in level with request.jwt.claims.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
