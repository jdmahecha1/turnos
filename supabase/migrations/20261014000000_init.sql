-- Turnos: schema, security and booking logic.
--
-- Design rules:
--   * Every table has row level security. The public (anon) role can read what a booking
--     page needs, but never customer data.
--   * Appointments are created only through book_appointment(), which validates the slot.
--   * The database itself guarantees that two confirmed appointments of the same business
--     never overlap (exclusion constraint), even with concurrent requests.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name       text not null check (char_length(name) between 2 and 80),
  timezone   text not null default 'America/Bogota',
  created_at timestamptz not null default now()
);
comment on table public.businesses is 'One business per owner; its slug is the public booking URL.';

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 60),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cop        integer not null default 0 check (price_cop >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index services_business_id_idx on public.services (business_id);

create table public.working_hours (
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = Sunday, like extract(dow)
  opens_at    time not null,
  closes_at   time not null,
  primary key (business_id, weekday),
  check (opens_at < closes_at)
);

create table public.appointments (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  service_id     uuid not null references public.services (id) on delete restrict,
  customer_name  text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{7,15}$'),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at     timestamptz not null default now(),
  check (starts_at < ends_at),
  -- The core guarantee: no two confirmed appointments of a business overlap in time.
  constraint appointments_no_overlap exclude using gist (
    business_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);
create index appointments_service_id_idx on public.appointments (service_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.businesses    enable row level security;
alter table public.services      enable row level security;
alter table public.working_hours enable row level security;
alter table public.appointments  enable row level security;

create policy "Anyone can view businesses"
  on public.businesses for select to anon, authenticated
  using (true);

create policy "Owners can create their business"
  on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update their business"
  on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete their business"
  on public.businesses for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Anyone can view active services"
  on public.services for select to anon, authenticated
  using (
    active
    or business_id in (select id from public.businesses where owner_id = (select auth.uid()))
  );

create policy "Owners manage their services"
  on public.services for all to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Anyone can view working hours"
  on public.working_hours for select to anon, authenticated
  using (true);

create policy "Owners manage their working hours"
  on public.working_hours for all to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- Customers' names and phones are visible only to the business owner.
create policy "Owners can view their appointments"
  on public.appointments for select to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

create policy "Owners can update their appointments"
  on public.appointments for update to authenticated
  using (business_id in (select id from public.businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from public.businesses where owner_id = (select auth.uid())));

-- Owners may only change the status (cancel); times, service and customer stay as booked.
revoke insert, update, delete on public.appointments from anon, authenticated;
grant update (status) on public.appointments to authenticated;
revoke insert, update, delete on public.businesses, public.services, public.working_hours from anon;
-- TRUNCATE bypasses row level security, so nobody but the server may use it.
revoke truncate on public.businesses, public.services, public.working_hours, public.appointments
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking functions (the only way to create appointments)
-- ---------------------------------------------------------------------------

-- Free start times for a service on a given day, every 15 minutes, in the future and at
-- most 60 days ahead. Times are returned as timestamptz; the client formats them.
create function public.available_slots(p_business_slug text, p_service_id uuid, p_day date)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select id, timezone from public.businesses where slug = p_business_slug
  ),
  s as (
    select sv.duration_minutes
    from public.services sv join b on sv.business_id = b.id
    where sv.id = p_service_id and sv.active
  ),
  h as (
    select wh.opens_at, wh.closes_at
    from public.working_hours wh join b on wh.business_id = b.id
    where wh.weekday = extract(dow from p_day)
  ),
  candidates as (
    select
      (local_start at time zone b.timezone) as slot_start,
      make_interval(mins => s.duration_minutes) as duration
    from b, s, h,
      generate_series(
        p_day + h.opens_at,
        p_day + h.closes_at - make_interval(mins => s.duration_minutes),
        interval '15 minutes'
      ) as local_start
  )
  select c.slot_start
  from candidates c, b
  where c.slot_start > now()
    and p_day <= (now() at time zone b.timezone)::date + 60
    and not exists (
      select 1 from public.appointments a
      where a.business_id = b.id
        and a.status = 'confirmed'
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.slot_start, c.slot_start + c.duration)
    )
  order by c.slot_start;
$$;

create function public.book_appointment(
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
    select 1 from public.available_slots(p_business_slug, p_service_id, v_local_day) s
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

revoke execute on function public.available_slots(text, uuid, date) from public;
revoke execute on function public.book_appointment(text, uuid, timestamptz, text, text) from public;
grant execute on function public.available_slots(text, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text)
  to anon, authenticated;
