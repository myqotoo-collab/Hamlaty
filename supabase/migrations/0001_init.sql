-- Hamlaty (حملتي) — initial schema for Supabase (PostgreSQL 15+).
-- Ziyarat campaigns send one group request (pilgrims, cities, nights, rooms); verified hotels in Karbala,
-- Najaf, Kadhimiya and Samarra answer with offers; the campaign books one and the hotel confirms.
--
-- Rules the database enforces, so the app cannot get them wrong:
--   • Neither side sees who the other is until the hotel confirms the booking (booking_contacts()).
--   • Phone numbers, emails and links typed into messages and notes are hidden (mask_contacts()).
--   • A hotel sees a request only when it was routed to it, and never sees another hotel's offer.
--   • A campaign never sees a draft offer. Offer totals are computed here, not trusted from the browser.
--   • Commission falls with each repeat booking between the same campaign and hotel (app_settings).
-- Money is stored in minor units (cents for USD) with its currency, to avoid rounding errors.

-- ───────────── Enums ─────────────
create type org_kind       as enum ('campaign', 'hotel');
create type org_status     as enum ('pending', 'active', 'suspended');
create type member_role    as enum ('owner', 'manager', 'staff');
create type meal_plan      as enum ('room_only', 'breakfast', 'half_board', 'full_board');
create type room_type      as enum ('single', 'double', 'triple', 'quad');
create type request_status as enum ('open', 'booked', 'closed', 'cancelled');
create type offer_status   as enum ('draft', 'sent', 'declined', 'accepted', 'not_chosen', 'expired', 'withdrawn');
create type booking_status as enum ('pending_hotel', 'confirmed', 'completed', 'cancelled');

-- The holy cities hotels can be in. Stored in Arabic; the app shows English names.
create or replace function holy_city_ok(c text) returns boolean
language sql immutable as $$ select c in ('كربلاء', 'النجف', 'الكاظمية', 'سامراء') $$;

-- Hides phone numbers, emails, links and social handles in free text, so a campaign and a hotel
-- cannot swap contacts before booking. Eight or more digits (with spaces or dashes) count as a phone.
create or replace function mask_contacts(t text) returns text
language sql immutable as $$
  select case when t is null then null else
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            translate(t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
            '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[•••]', 'g'),
          '(https?://|www\.|wa\.me/|t\.me/)[^[:space:]]*', '[•••]', 'gi'),
        '(\+|00)?[0-9]([[:space:].()-]?[0-9]){7,}', '[•••]', 'g'),
      '@[[:alnum:]_.]{3,}', '[•••]', 'g')
  end
$$;

-- ───────────── Organisations & people ─────────────
create table organizations (
  id                uuid primary key default gen_random_uuid(),
  kind              org_kind not null,
  name              text not null check (length(trim(name)) between 2 and 120),
  country           text not null default 'OM' check (country ~ '^[A-Z]{2}$'),   -- ISO code of the campaign's country
  city              text,
  phone             text,
  cr_number         text,                       -- commercial registration / tourism licence
  logo_url          text,
  status            org_status not null default 'pending',
  sms_notifications boolean not null default true,
  created_at        timestamptz not null default now()
);

create table profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table memberships (
  org_id   uuid not null references organizations(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     member_role not null default 'owner',
  primary key (org_id, user_id)
);
create index memberships_user on memberships (user_id);

-- What a campaign may know about a hotel before booking comes from here (city, stars, distance).
create table hotel_profiles (
  org_id               uuid primary key references organizations(id) on delete cascade,
  city                 text not null check (holy_city_ok(city)),
  stars                smallint not null check (stars between 1 and 5),
  distance_to_shrine_m int not null check (distance_to_shrine_m between 0 and 20000),
  shrine               text,                    -- e.g. حرم الإمام الحسين
  rooms_total          int check (rooms_total > 0),
  meals                meal_plan[] not null default '{room_only}',
  address              text,
  lat                  numeric(9, 6),
  lng                  numeric(9, 6),
  about                text,
  verified             boolean not null default false,  -- set by Hamlaty after checking photos and distance
  updated_at           timestamptz not null default now()
);

-- ───────────── Group requests ─────────────
create table group_requests (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique default ('H-' || upper(substr(md5(random()::text), 1, 6))),
  campaign_id     uuid not null references organizations(id) on delete cascade,
  created_by      uuid references auth.users(id),
  from_country    text,                         -- copied from the campaign, so hotels see "a campaign from Oman"
  pilgrims        int not null check (pilgrims between 1 and 2000),
  meal            meal_plan not null default 'breakfast',
  min_stars       smallint check (min_stars between 1 and 5),
  max_distance_m  int check (max_distance_m > 0),
  notes           text check (length(notes) <= 2000),
  status          request_status not null default 'open',
  respond_by      timestamptz not null default (now() + interval '48 hours'),
  created_at      timestamptz not null default now()
);
create index group_requests_campaign on group_requests (campaign_id, created_at desc);

-- One row per city in the trip: Karbala 3 nights, then Najaf 2 nights…
create table request_stays (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references group_requests(id) on delete cascade,
  position      smallint not null,
  city          text not null check (holy_city_ok(city)),
  check_in      date not null,
  nights        smallint not null check (nights between 1 and 30),
  rooms_single  smallint not null default 0 check (rooms_single >= 0),
  rooms_double  smallint not null default 0 check (rooms_double >= 0),
  rooms_triple  smallint not null default 0 check (rooms_triple >= 0),
  rooms_quad    smallint not null default 0 check (rooms_quad >= 0),
  check (rooms_single + rooms_double + rooms_triple + rooms_quad > 0),
  unique (request_id, position)
);

-- ───────────── Offers ─────────────
create table offers (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references group_requests(id) on delete cascade,
  hotel_id         uuid not null references organizations(id) on delete cascade,
  status           offer_status not null default 'draft',
  currency         text not null default 'USD' check (currency in ('USD', 'IQD')),
  total_minor      bigint not null default 0 check (total_minor >= 0),
  meal             meal_plan,
  valid_until      date,
  notes            text check (length(notes) <= 2000),
  -- What the campaign sees instead of the hotel's name, copied from hotel_profiles when the offer is sent.
  snap_city        text,
  snap_stars       smallint,
  snap_distance_m  int,
  snap_shrine      text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (request_id, hotel_id)
);
create index offers_hotel on offers (hotel_id, created_at desc);

create table offer_lines (
  id                uuid primary key default gen_random_uuid(),
  offer_id          uuid not null references offers(id) on delete cascade,
  stay_id           uuid not null references request_stays(id) on delete cascade,
  room_type         room_type not null,
  rooms             smallint not null check (rooms > 0),
  nights            smallint not null check (nights > 0),
  rate_minor        bigint not null check (rate_minor > 0),          -- per room per night
  line_total_minor  bigint generated always as (rooms::bigint * nights * rate_minor) stored,
  unique (offer_id, stay_id, room_type)
);

-- ───────────── Bookings, commission, credit ─────────────
create table bookings (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique default ('B-' || upper(substr(md5(random()::text), 1, 6))),
  request_id       uuid not null references group_requests(id) on delete cascade,
  offer_id         uuid not null unique references offers(id) on delete cascade,
  campaign_id      uuid not null references organizations(id),
  hotel_id         uuid not null references organizations(id),
  status           booking_status not null default 'pending_hotel',
  currency         text not null,
  total_minor      bigint not null check (total_minor >= 0),
  commission_pct   numeric(5, 2) not null,
  commission_minor bigint not null,
  credit_minor     bigint not null default 0,
  created_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  cancelled_by     uuid
);
create index bookings_pair on bookings (campaign_id, hotel_id);

-- Credit a campaign earns on completed bookings, spendable only on Hamlaty. Negative rows are spending.
create table campaign_credits (
  id            bigserial primary key,
  campaign_id   uuid not null references organizations(id) on delete cascade,
  booking_id    uuid unique references bookings(id) on delete set null,
  amount_minor  bigint not null,
  currency      text not null,
  note          text,
  created_at    timestamptz not null default now()
);

-- Messages between a campaign and a hotel about one offer. Contact details are masked on the way in.
create table messages (
  id           bigserial primary key,
  offer_id     uuid not null references offers(id) on delete cascade,
  sender_org   uuid not null references organizations(id) on delete cascade,
  sender_user  uuid default auth.uid(),
  body         text not null check (length(trim(body)) between 1 and 2000),
  masked       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index messages_offer on messages (offer_id, created_at);

-- ───────────── Trips and pilgrims (campaign tools) ─────────────
create table trips (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references organizations(id) on delete cascade,
  name         text not null check (length(trim(name)) between 2 and 120),
  starts_on    date,
  ends_on      date,
  join_code    text not null unique default lower(substr(md5(random()::text), 1, 8)),
  created_at   timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table pilgrims (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  full_name        text not null check (length(trim(full_name)) between 2 and 120),
  phone            text,
  gender           text check (gender in ('m', 'f')),
  birth_year       smallint check (birth_year between 1900 and 2100),
  nationality      text,
  passport_no      text check (length(passport_no) <= 20),
  emergency_phone  text,
  room_label       text,
  created_at       timestamptz not null default now()
);
create index pilgrims_trip on pilgrims (trip_id);

-- ───────────── Settings, notifications, audit ─────────────
create table app_settings (
  key    text primary key,
  value  jsonb not null
);
insert into app_settings (key, value) values
  ('commission_tiers', '[5, 2, 1]'),   -- % on the 1st, 2nd, then every later booking between a campaign and a hotel
  ('campaign_credit_pct', '1');        -- % of a completed booking credited to the campaign

create table notifications (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  kind        text not null check (kind in ('new_request', 'offer_sent', 'offer_accepted', 'booking_confirmed', 'booking_cancelled', 'message')),
  key         text not null,
  to_phone    text,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  detail      text,
  created_at  timestamptz not null default now(),
  unique (org_id, kind, key)
);

create table audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  org_id     uuid,
  entity     text not null,
  entity_id  uuid,
  action     text not null,
  detail     jsonb not null default '{}'
);

-- ───────────── Helpers used by policies ─────────────
-- Admin access needs the authenticator-app check (Supabase "aal2") on top of the phone code.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid())
$$;

create or replace function my_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid()
$$;

-- The request belongs to one of my campaigns.
create or replace function my_request(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_requests g where g.id = r and g.campaign_id in (select my_orgs()))
$$;

-- A hotel sees a request only once it was routed to it.
create or replace function request_routed_to_me(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from offers o where o.request_id = r and o.hotel_id in (select my_orgs()))
$$;

-- Offers the campaign may see: never drafts or declined ones.
create or replace function offer_visible(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from offers x join group_requests g on g.id = x.request_id
     where x.id = o
       and (x.hotel_id in (select my_orgs())
            or (x.status in ('sent', 'accepted', 'not_chosen', 'withdrawn', 'expired') and g.campaign_id in (select my_orgs()))))
$$;

create or replace function my_trip(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and campaign_id in (select my_orgs()))
$$;

-- Functions below change rows the guards would otherwise refuse; they mark the change as theirs.
create or replace function internal_on() returns void language sql as $$ select set_config('hamlaty.internal', 'on', true) $$;
create or replace function internal_off() returns void language sql as $$ select set_config('hamlaty.internal', 'off', true) $$;
create or replace function is_internal() returns boolean language sql stable as $$
  select coalesce(current_setting('hamlaty.internal', true), '') = 'on'
$$;

-- ───────────── Sign-up ─────────────
-- One call creates the user's organisation, owner membership and profile.
-- Campaigns are active at once; hotels wait until Hamlaty checks them.
create or replace function create_my_organization(p_kind org_kind, p_name text, p_country text default 'OM', p_city text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null then raise exception 'sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  select org_id into v_org from memberships where user_id = v_uid limit 1;
  if v_org is not null then return v_org; end if;

  insert into profiles (user_id, phone) values (v_uid, (select phone from auth.users where id = v_uid))
  on conflict (user_id) do nothing;

  insert into organizations (kind, name, country, city, status)
  values (p_kind, trim(p_name),
          case when p_kind = 'hotel' then 'IQ' else upper(coalesce(nullif(trim(p_country), ''), 'OM')) end,
          nullif(trim(p_city), ''),
          case when p_kind = 'campaign' then 'active'::org_status else 'pending'::org_status end)
  returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into audit_log (actor, org_id, entity, entity_id, action) values (v_uid, v_org, 'organization', v_org, 'create');
  return v_org;
end $$;

-- Members may edit their details, never the status or kind.
create or replace function guard_org_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.status is distinct from old.status or new.kind is distinct from old.kind) then
    raise exception 'only an admin can change an organization''s status';
  end if;
  return new;
end $$;
create trigger organizations_guard before update on organizations for each row execute function guard_org_update();

-- A hotel that changes its city, stars or distance must be checked again before it gets requests.
create or replace function guard_hotel_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind from organizations where id = new.org_id) <> 'hotel' then
    raise exception 'only a hotel has a hotel profile';
  end if;
  new.about := mask_contacts(new.about);
  new.updated_at := now();
  if not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.city is distinct from old.city or new.stars is distinct from old.stars
          or new.distance_to_shrine_m is distinct from old.distance_to_shrine_m then
      new.verified := false;
    elsif new.verified is distinct from old.verified then
      raise exception 'only an admin can verify a hotel';
    end if;
  end if;
  return new;
end $$;
create trigger hotel_profiles_guard before insert or update on hotel_profiles for each row execute function guard_hotel_profile();

-- ───────────── Requests ─────────────
create or replace function guard_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.notes := mask_contacts(new.notes);
  if tg_op = 'INSERT' then
    if (select kind from organizations where id = new.campaign_id) <> 'campaign'
       or (select status from organizations where id = new.campaign_id) <> 'active' then
      raise exception 'only an active campaign can send a request';
    end if;
    new.from_country := (select country from organizations where id = new.campaign_id);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.status := 'open';
    return new;
  end if;
  if is_admin() or is_internal() then return new; end if;
  if new.campaign_id is distinct from old.campaign_id or new.from_country is distinct from old.from_country then
    raise exception 'request owner cannot change';
  end if;
  if old.status <> 'open' then raise exception 'request is % and can no longer be changed', old.status; end if;
  if new.status not in ('open', 'cancelled', 'closed') then raise exception 'not allowed'; end if;
  -- Once hotels have answered, only the notes and closing the request may change.
  if exists (select 1 from offers where request_id = old.id and status <> 'draft')
     and (new.pilgrims, new.meal, new.min_stars, new.max_distance_m, new.respond_by)
         is distinct from (old.pilgrims, old.meal, old.min_stars, old.max_distance_m, old.respond_by) then
    raise exception 'hotels already answered this request; cancel it and send a new one';
  end if;
  return new;
end $$;
create trigger group_requests_guard before insert or update on group_requests for each row execute function guard_request();

create or replace function guard_stay() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req uuid := coalesce(new.request_id, old.request_id);
begin
  if is_admin() or is_internal() then return coalesce(new, old); end if;
  if (select status from group_requests where id = v_req) <> 'open'
     or exists (select 1 from offers where request_id = v_req and status <> 'draft') then
    raise exception 'stays can no longer be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger request_stays_guard before insert or update or delete on request_stays for each row execute function guard_stay();

-- Sends a request to every verified, active hotel in its cities that meets its stars and distance.
-- Each hotel gets an empty draft offer to fill in. Safe to call again (new hotels are added).
create or replace function dispatch_request(p_request uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r group_requests; n int;
begin
  select * into r from group_requests where id = p_request;
  if r.id is null then raise exception 'request not found'; end if;
  if not (is_member(r.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if r.status <> 'open' then raise exception 'request is %', r.status; end if;
  if not exists (select 1 from request_stays where request_id = r.id) then raise exception 'add at least one city'; end if;

  insert into offers (request_id, hotel_id, meal)
  select r.id, h.org_id, r.meal
    from hotel_profiles h join organizations o on o.id = h.org_id
   where o.kind = 'hotel' and o.status = 'active' and h.verified
     and h.city in (select city from request_stays where request_id = r.id)
     and h.stars >= coalesce(r.min_stars, 1)
     and (r.max_distance_m is null or h.distance_to_shrine_m <= r.max_distance_m)
  on conflict (request_id, hotel_id) do nothing;
  get diagnostics n = row_count;
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), r.campaign_id, 'request', r.id, 'dispatch', jsonb_build_object('hotels', n));
  return n;
end $$;

-- ───────────── Offers ─────────────
create or replace function guard_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare h hotel_profiles; r group_requests;
begin
  if tg_op = 'INSERT' then
    -- Offers are created empty by dispatch_request (there is no insert policy for users).
    new.status := 'draft';
    new.total_minor := 0;
    new.sent_at := null;
    return new;
  end if;

  new.notes := mask_contacts(new.notes);
  if is_admin() or is_internal() then return new; end if;
  if new.request_id is distinct from old.request_id or new.hotel_id is distinct from old.hotel_id then
    raise exception 'not allowed';
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    return new;                                   -- the hotel is filling it in
  elsif old.status = 'draft' and new.status = 'sent' then
    select * into r from group_requests where id = old.request_id;
    if r.status <> 'open' then raise exception 'request is % and can no longer get offers', r.status; end if;
    if r.respond_by < now() then raise exception 'the time to answer this request has passed'; end if;
    if (select status from organizations where id = old.hotel_id) <> 'active' then raise exception 'hotel account is not active yet'; end if;
    select * into h from hotel_profiles where org_id = old.hotel_id;
    if h.org_id is null then raise exception 'complete your hotel profile first'; end if;
    if not exists (select 1 from offer_lines where offer_id = old.id) then raise exception 'add at least one room price'; end if;
    new.total_minor := (select sum(line_total_minor) from offer_lines where offer_id = old.id);
    new.snap_city := h.city; new.snap_stars := h.stars; new.snap_distance_m := h.distance_to_shrine_m; new.snap_shrine := h.shrine;
    new.sent_at := now();
    insert into audit_log (actor, org_id, entity, entity_id, action, detail)
    values (auth.uid(), old.hotel_id, 'offer', old.id, 'send', jsonb_build_object('total_minor', new.total_minor, 'currency', new.currency));
    return new;
  elsif old.status = 'draft' and new.status = 'declined' then
    return new;
  elsif old.status = 'sent' and new.status = 'withdrawn'
        and (select status from group_requests where id = old.request_id) = 'open' then
    return new;
  elsif old.status = 'sent' and new.status = 'sent'
        and (new.total_minor, new.currency, new.meal, new.valid_until, new.sent_at,
             new.snap_city, new.snap_stars, new.snap_distance_m, new.snap_shrine)
            is not distinct from
            (old.total_minor, old.currency, old.meal, old.valid_until, old.sent_at,
             old.snap_city, old.snap_stars, old.snap_distance_m, old.snap_shrine) then
    return new;                                   -- notes only
  end if;
  raise exception 'offer is % and can no longer be changed', old.status;
end $$;
create trigger offers_guard before insert or update on offers for each row execute function guard_offer();

-- Room prices: only the hotel, only while its offer is a draft, only for stays in its own city.
create or replace function guard_offer_line() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_offer uuid := coalesce(new.offer_id, old.offer_id); o offers; s request_stays;
begin
  select * into o from offers where id = v_offer;
  if not (is_admin() or is_internal()) and o.status <> 'draft' then
    raise exception 'offer is % and can no longer be changed', o.status;
  end if;
  if tg_op <> 'DELETE' then
    select * into s from request_stays where id = new.stay_id;
    if s.request_id is distinct from o.request_id then raise exception 'that stay is not part of this request'; end if;
    if s.city is distinct from (select city from hotel_profiles where org_id = o.hotel_id) then
      raise exception 'you can only price stays in your city';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger offer_lines_guard before insert or update or delete on offer_lines for each row execute function guard_offer_line();

-- ───────────── Booking ─────────────
-- The campaign books an offer. Offers from other hotels for the same stays are set aside.
-- Commission: tiers[1] on the first booking between this campaign and hotel, tiers[2] on the second, …
create or replace function accept_offer(p_offer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o offers; r group_requests; v_prior int; v_tiers jsonb; v_pct numeric; v_booking uuid;
begin
  select * into o from offers where id = p_offer for update;
  if o.id is null then raise exception 'offer not found'; end if;
  select * into r from group_requests where id = o.request_id for update;
  if not (is_member(r.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if r.status <> 'open' then raise exception 'request is % and can no longer be booked', r.status; end if;
  if o.status <> 'sent' then raise exception 'only a sent offer can be booked'; end if;
  if o.valid_until is not null and o.valid_until < current_date then raise exception 'this offer has expired'; end if;
  if exists (select 1 from offer_lines l join offer_lines a on a.stay_id = l.stay_id
               join offers x on x.id = a.offer_id
              where l.offer_id = o.id and x.status = 'accepted') then
    raise exception 'a city in this offer is already booked';
  end if;

  select count(*) into v_prior from bookings
   where campaign_id = r.campaign_id and hotel_id = o.hotel_id and status in ('confirmed', 'completed');
  select value into v_tiers from app_settings where key = 'commission_tiers';
  v_tiers := coalesce(v_tiers, '[5]');
  v_pct := (v_tiers ->> least(v_prior, jsonb_array_length(v_tiers) - 1))::numeric;

  perform internal_on();
  update offers set status = 'accepted' where id = o.id;
  -- Other offers covering any of the same stays are no longer needed.
  update offers x set status = 'not_chosen'
   where x.request_id = r.id and x.id <> o.id and x.status = 'sent'
     and exists (select 1 from offer_lines a join offer_lines b on b.stay_id = a.stay_id
                  where a.offer_id = x.id and b.offer_id = o.id);
  insert into bookings (request_id, offer_id, campaign_id, hotel_id, currency, total_minor, commission_pct, commission_minor)
  values (r.id, o.id, r.campaign_id, o.hotel_id, o.currency, o.total_minor, v_pct, round(o.total_minor * v_pct / 100))
  returning id into v_booking;
  -- Fully booked once every stay has an accepted offer.
  if not exists (select 1 from request_stays s where s.request_id = r.id
                   and not exists (select 1 from offer_lines l join offers x on x.id = l.offer_id
                                    where l.stay_id = s.id and x.status = 'accepted')) then
    update group_requests set status = 'booked' where id = r.id;
  end if;
  perform internal_off();
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), r.campaign_id, 'booking', v_booking, 'create', jsonb_build_object('offer', o.id, 'commission_pct', v_pct));
  return v_booking;
end $$;

-- The hotel confirms it holds the rooms. From now on both sides see each other's contacts.
create or replace function confirm_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status <> 'pending_hotel' then raise exception 'booking is %', b.status; end if;
  update bookings set status = 'confirmed', confirmed_at = now() where id = b.id;
  insert into audit_log (actor, org_id, entity, entity_id, action) values (auth.uid(), b.hotel_id, 'booking', b.id, 'confirm');
end $$;

-- Either side cancels. The request opens again so the campaign can book another hotel.
create or replace function cancel_booking(p_booking uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_member(b.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status not in ('pending_hotel', 'confirmed') then raise exception 'booking is %', b.status; end if;
  perform internal_on();
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid() where id = b.id;
  update offers set status = 'withdrawn' where id = b.offer_id;
  update group_requests set status = 'open' where id = b.request_id and status = 'booked';
  perform internal_off();
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), null, 'booking', b.id, 'cancel', jsonb_build_object('reason', left(mask_contacts(p_reason), 500)));
end $$;

-- After the stay: the hotel (or Hamlaty) marks it done and the campaign earns its credit.
create or replace function complete_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; v_pct numeric; v_credit bigint;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status <> 'confirmed' then raise exception 'booking is %', b.status; end if;
  select coalesce((value #>> '{}')::numeric, 0) into v_pct from app_settings where key = 'campaign_credit_pct';
  v_credit := round(b.total_minor * coalesce(v_pct, 0) / 100);
  update bookings set status = 'completed', completed_at = now(), credit_minor = v_credit where id = b.id;
  if v_credit > 0 then
    insert into campaign_credits (campaign_id, booking_id, amount_minor, currency, note)
    values (b.campaign_id, b.id, v_credit, b.currency, 'booking ' || b.ref);
  end if;
  insert into audit_log (actor, org_id, entity, entity_id, action) values (auth.uid(), b.hotel_id, 'booking', b.id, 'complete');
end $$;

-- Names and phones of both sides, only after the hotel confirmed.
create or replace function booking_contacts(p_booking uuid)
returns table (hotel_name text, hotel_phone text, hotel_address text, hotel_city text, campaign_name text, campaign_phone text, campaign_country text)
language plpgsql stable security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking;
  if b.id is null or not (is_member(b.hotel_id) or is_member(b.campaign_id) or is_admin()) then return; end if;
  if b.status not in ('confirmed', 'completed') and not is_admin() then return; end if;
  return query
    select h.name, h.phone, hp.address, hp.city, c.name, c.phone, c.country
      from organizations h left join hotel_profiles hp on hp.org_id = h.id, organizations c
     where h.id = b.hotel_id and c.id = b.campaign_id;
end $$;

-- ───────────── Messages ─────────────
create or replace function guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare o offers; v_campaign uuid; v_typed text := new.body;
begin
  select * into o from offers where id = new.offer_id;
  select campaign_id into v_campaign from group_requests where id = o.request_id;
  if not is_admin() then
    if not is_member(new.sender_org) or new.sender_org not in (o.hotel_id, v_campaign) then
      raise exception 'not allowed';
    end if;
    if new.sender_org = v_campaign and o.status = 'draft' then raise exception 'the hotel has not answered yet'; end if;
    if o.status in ('declined', 'withdrawn') then raise exception 'this offer is closed'; end if;
  end if;
  new.sender_user := auth.uid();
  -- Contacts stay hidden until the hotel confirms the booking; after that the two sides may share them.
  if not exists (select 1 from bookings where offer_id = o.id and status in ('confirmed', 'completed')) then
    new.body := mask_contacts(v_typed);
  end if;
  new.masked := new.body is distinct from v_typed;
  return new;
end $$;
create trigger messages_guard before insert on messages for each row execute function guard_message();

-- ───────────── Pilgrim self-registration (public link) ─────────────
create or replace function trip_by_code(p_code text)
returns table (trip_name text, campaign_name text, starts_on date, ends_on date)
language sql stable security definer set search_path = public as $$
  select t.name, o.name, t.starts_on, t.ends_on
    from trips t join organizations o on o.id = t.campaign_id
   where t.join_code = lower(trim(p_code)) and (t.ends_on is null or t.ends_on >= current_date)
$$;

create or replace function register_pilgrim(p_code text, p_full_name text, p_phone text default null, p_gender text default null,
  p_birth_year int default null, p_nationality text default null, p_passport_no text default null, p_emergency_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t trips; v_id uuid;
begin
  select * into t from trips where join_code = lower(trim(p_code)) and (ends_on is null or ends_on >= current_date);
  if t.id is null then raise exception 'registration link is not valid'; end if;
  if (select count(*) from pilgrims where trip_id = t.id) >= 2000 then raise exception 'this trip is full'; end if;
  insert into pilgrims (trip_id, full_name, phone, gender, birth_year, nationality, passport_no, emergency_phone)
  values (t.id, trim(p_full_name), nullif(trim(p_phone), ''), nullif(p_gender, ''), p_birth_year,
          nullif(trim(p_nationality), ''), upper(nullif(trim(p_passport_no), '')), nullif(trim(p_emergency_phone), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ───────────── Row Level Security ─────────────
alter table organizations    enable row level security;
alter table profiles         enable row level security;
alter table memberships      enable row level security;
alter table hotel_profiles   enable row level security;
alter table group_requests   enable row level security;
alter table request_stays    enable row level security;
alter table offers           enable row level security;
alter table offer_lines      enable row level security;
alter table bookings         enable row level security;
alter table campaign_credits enable row level security;
alter table messages         enable row level security;
alter table trips            enable row level security;
alter table pilgrims         enable row level security;
alter table app_settings     enable row level security;
alter table notifications    enable row level security;
alter table audit_log        enable row level security;

-- Organisations: only your own (and admins). No one browses other campaigns or hotels.
create policy orgs_read   on organizations for select to authenticated using (is_member(id) or is_admin());
create policy orgs_update on organizations for update to authenticated using (is_member(id) or is_admin()) with check (is_member(id) or is_admin());
create policy orgs_admin  on organizations for all    to authenticated using (is_admin()) with check (is_admin());

create policy profiles_self on profiles for all to authenticated
  using (user_id = auth.uid() or is_admin()) with check ((user_id = auth.uid() and is_admin = false) or is_admin());
create policy memberships_read on memberships for select to authenticated using (user_id = auth.uid() or is_member(org_id) or is_admin());
create policy memberships_admin on memberships for all to authenticated using (is_admin()) with check (is_admin());

create policy hotel_profiles_own on hotel_profiles for all to authenticated
  using (is_member(org_id) or is_admin()) with check (is_member(org_id) or is_admin());

create policy requests_read on group_requests for select to authenticated
  using (is_member(campaign_id) or request_routed_to_me(id) or is_admin());
create policy requests_insert on group_requests for insert to authenticated with check (is_member(campaign_id) or is_admin());
create policy requests_update on group_requests for update to authenticated
  using (is_member(campaign_id) or is_admin()) with check (is_member(campaign_id) or is_admin());

create policy stays_read on request_stays for select to authenticated
  using (my_request(request_id) or request_routed_to_me(request_id) or is_admin());
create policy stays_write on request_stays for all to authenticated
  using (my_request(request_id) or is_admin()) with check (my_request(request_id) or is_admin());

create policy offers_read on offers for select to authenticated using (offer_visible(id) or is_admin());
create policy offers_update on offers for update to authenticated
  using (is_member(hotel_id) or is_admin()) with check (is_member(hotel_id) or is_admin());

create policy offer_lines_read on offer_lines for select to authenticated using (offer_visible(offer_id) or is_admin());
create policy offer_lines_write on offer_lines for all to authenticated
  using (exists (select 1 from offers o where o.id = offer_id and is_member(o.hotel_id)) or is_admin())
  with check (exists (select 1 from offers o where o.id = offer_id and is_member(o.hotel_id)) or is_admin());

create policy bookings_read on bookings for select to authenticated using (is_member(campaign_id) or is_member(hotel_id) or is_admin());
create policy bookings_admin on bookings for update to authenticated using (is_admin()) with check (is_admin());

create policy credits_read on campaign_credits for select to authenticated using (is_member(campaign_id) or is_admin());

create policy messages_read on messages for select to authenticated using (offer_visible(offer_id) or is_admin());
create policy messages_insert on messages for insert to authenticated with check (is_member(sender_org) or is_admin());

create policy trips_own on trips for all to authenticated
  using (is_member(campaign_id) or is_admin()) with check (is_member(campaign_id) or is_admin());
create policy pilgrims_own on pilgrims for all to authenticated
  using (my_trip(trip_id) or is_admin()) with check (my_trip(trip_id) or is_admin());

create policy settings_read on app_settings for select to authenticated using (true);
create policy settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy notifications_admin on notifications for select to authenticated using (is_admin());
create policy audit_admin on audit_log for select to authenticated using (is_admin());

-- ───────────── Who may call what ─────────────
-- Signed-in users may call the functions above; visitors only the pilgrim registration link.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function internal_on(), internal_off() from authenticated;
grant execute on function trip_by_code(text), register_pilgrim(text, text, text, text, int, text, text, text) to anon;
-- Visitors (not signed in) read no table directly; the pilgrim link works through the two functions above.
revoke all on all tables in schema public from anon;
revoke all on notifications, audit_log from authenticated;
grant select on notifications, audit_log to authenticated;
