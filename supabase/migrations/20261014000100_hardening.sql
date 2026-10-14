-- Hardening after running the Supabase security and performance advisors.

-- ---------------------------------------------------------------------------
-- 1. Booking logic out of the exposed API schema
-- ---------------------------------------------------------------------------
-- The booking functions run as SECURITY DEFINER because they must see every appointment
-- to know which times are free, without revealing those appointments to the caller.
-- They now live in `private`, which the API does not expose; the public functions are
-- thin SECURITY INVOKER wrappers, so the only elevated code is the one we wrote on purpose.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.available_slots(text, uuid, date) set schema private;
drop function public.book_appointment(text, uuid, timestamptz, text, text);

create function private.book_appointment(
  p_business_slug  text,
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_phone text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_duration integer;
  v_local_day date;
  v_id uuid;
begin
  select * into v_business from public.businesses where slug = p_business_slug;
  if not found then
    raise exception 'business_not_found';
  end if;

  select duration_minutes into v_duration
  from public.services
  where id = p_service_id and business_id = v_business.id and active;
  if not found then
    raise exception 'service_not_found';
  end if;

  v_local_day := (p_starts_at at time zone v_business.timezone)::date;
  if not exists (
    select 1 from private.available_slots(p_business_slug, p_service_id, v_local_day) s
    where s.starts_at = p_starts_at
  ) then
    raise exception 'slot_unavailable';
  end if;

  insert into public.appointments
    (business_id, service_id, customer_name, customer_phone, starts_at, ends_at)
  values (
    v_business.id,
    p_service_id,
    btrim(p_customer_name),
    regexp_replace(p_customer_phone, '[\s()-]', '', 'g'),
    p_starts_at,
    p_starts_at + make_interval(mins => v_duration)
  )
  returning id into v_id;

  return v_id;
exception
  -- Two people booked the same slot at the same moment: the constraint picked a winner.
  when exclusion_violation then
    raise exception 'slot_unavailable';
  when check_violation then
    raise exception 'invalid_customer_data';
end;
$$;

create function public.available_slots(p_business_slug text, p_service_id uuid, p_day date)
returns table (starts_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.starts_at from private.available_slots(p_business_slug, p_service_id, p_day) s;
$$;

create function public.book_appointment(
  p_business_slug  text,
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_phone text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.book_appointment(
    p_business_slug, p_service_id, p_starts_at, p_customer_name, p_customer_phone
  );
$$;

revoke execute on function private.book_appointment(text, uuid, timestamptz, text, text) from public;
revoke execute on function public.available_slots(text, uuid, date) from public;
revoke execute on function public.book_appointment(text, uuid, timestamptz, text, text) from public;
grant execute on function private.available_slots(text, uuid, date) to anon, authenticated;
grant execute on function private.book_appointment(text, uuid, timestamptz, text, text)
  to anon, authenticated;
grant execute on function public.available_slots(text, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. One SELECT policy per table
-- ---------------------------------------------------------------------------
-- "for all" owner policies also applied to SELECT, so Postgres evaluated two policies
-- on every read. The public SELECT policies already cover owners.

drop policy "Owners manage their services" on public.services;

create policy "Owners can add services"
  on public.services for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Owners can update their services"
  on public.services for update to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Owners can delete their services"
  on public.services for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

drop policy "Owners manage their working hours" on public.working_hours;

create policy "Owners can add working hours"
  on public.working_hours for insert to authenticated
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Owners can update their working hours"
  on public.working_hours for update to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Owners can delete their working hours"
  on public.working_hours for delete to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));
