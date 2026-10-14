-- Minimal stand-in for what Supabase provides, so migrations run in PGlite during tests.
-- auth.uid() reads the user id from the same setting PostgREST fills from the JWT.

create schema if not exists auth;
create schema if not exists extensions;

create table auth.users (
  id    uuid primary key,
  email text
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon nologin;
create role authenticated nologin;

grant usage on schema public, auth, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase grants everything on public tables to these roles: RLS is what protects data.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
