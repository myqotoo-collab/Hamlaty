-- Hamlaty 0002 — flat fees taken from the deposit, and flight booking offices.
-- Run once in the Supabase SQL Editor, after 0001_init.sql.
--
-- Fees (app_settings, in US cents so they can change without code):
--   • 1 USD per pilgrim for each hotel booked (a request with 2 hotels and 45 pilgrims = 90 USD).
--   • 3 USD per flight ticket (a return ticket counts as one).
-- No one pays anything in advance. The fee is due once the hotel or office confirms, as part of the
-- deposit: the campaign pays it to Hamlaty and the rest of the deposit to the provider directly.
-- Only after the fee is recorded as paid is the booking confirmed and are the two sides' contacts shown.
--
-- Flight offices work like hotels: verified by Hamlaty, see only requests routed to them, never see
-- each other's offers, prices locked once sent, identities hidden until the fee is paid.

-- New enum values are only used inside function bodies below (allowed in the same transaction).
alter type org_kind add value if not exists 'agency';
alter type booking_status add value if not exists 'awaiting_payment' after 'pending_hotel';

-- ───────────── Fees replace the percentage commission and the campaign credit ─────────────
delete from app_settings where key in ('commission_tiers', 'campaign_credit_pct');
insert into app_settings (key, value) values
  ('fee_per_pilgrim_hotel_minor', '100'),   -- 1.00 USD per pilgrim, per hotel booked
  ('fee_per_ticket_minor', '300'),          -- 3.00 USD per flight ticket
  ('fee_currency', '"USD"')
on conflict (key) do update set value = excluded.value;

drop function if exists complete_booking(uuid);
drop table if exists campaign_credits;
alter table bookings drop column if exists commission_pct, drop column if exists commission_minor, drop column if exists credit_minor;

-- ───────────── Flight offices ─────────────
create table agency_profiles (
  org_id      uuid primary key references organizations(id) on delete cascade,
  license_no  text,                                 -- travel agency licence / IATA number
  countries   text[] not null default '{}',         -- campaign countries it serves (ISO codes); empty = all
  airlines    text,                                 -- airlines it usually books, e.g. "Oman Air, SalamAir"
  about       text,
  verified    boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- One row per flight in the trip: e.g. MCT → NJF on 10 March, returning 17 March, 45 seats.
create table request_flights (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references group_requests(id) on delete cascade,
  position     smallint not null,
  from_airport text not null check (from_airport ~ '^[A-Z]{3}$'),
  to_airport   text not null check (to_airport ~ '^[A-Z]{3}$'),
  depart_on    date not null,
  return_on    date,
  seats        int not null check (seats between 1 and 2000),
  baggage_kg   smallint check (baggage_kg between 0 and 100),
  check (return_on is null or return_on >= depart_on),
  unique (request_id, position)
);

create table flight_offers (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references group_requests(id) on delete cascade,
  agency_id    uuid not null references organizations(id) on delete cascade,
  status       offer_status not null default 'draft',
  currency     text not null default 'USD' check (currency in ('USD', 'IQD', 'OMR', 'KWD', 'BHD', 'SAR', 'AED', 'QAR')),
  total_minor  bigint not null default 0 check (total_minor >= 0),
  valid_until  timestamptz,                         -- seats are held until then
  notes        text check (length(notes) <= 2000),
  snap_country text,                                -- shown instead of the office's name: "an office in Oman"
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (request_id, agency_id)
);
create index flight_offers_agency on flight_offers (agency_id, created_at desc);

create table flight_offer_lines (
  id                uuid primary key default gen_random_uuid(),
  offer_id          uuid not null references flight_offers(id) on delete cascade,
  flight_id         uuid not null references request_flights(id) on delete cascade,
  airline           text not null check (length(trim(airline)) between 2 and 60),
  flight_no         text check (length(flight_no) <= 20),
  depart_at         timestamptz,
  return_at         timestamptz,
  seats             int not null check (seats > 0),
  fare_minor        bigint not null check (fare_minor > 0),            -- per seat; a return ticket is one seat
  line_total_minor  bigint generated always as (seats::bigint * fare_minor) stored,
  unique (offer_id, flight_id)
);

-- ───────────── Bookings cover hotels and flights ─────────────
alter table bookings
  add column kind            text not null default 'hotel' check (kind in ('hotel', 'flight')),
  add column flight_offer_id uuid unique references flight_offers(id) on delete cascade,
  add column agency_id       uuid references organizations(id),
  add column units           int not null default 0,                -- pilgrims (hotel) or tickets (flight)
  add column fee_minor       bigint not null default 0,
  add column fee_currency    text not null default 'USD',
  add column fee_paid_at     timestamptz,
  add column fee_reference   text;
alter table bookings alter column offer_id drop not null, alter column hotel_id drop not null;
alter table bookings add constraint bookings_kind_ok check (
  (kind = 'hotel' and offer_id is not null and hotel_id is not null and flight_offer_id is null and agency_id is null)
  or (kind = 'flight' and flight_offer_id is not null and agency_id is not null and offer_id is null and hotel_id is null));
create index bookings_agency on bookings (agency_id);

-- Messages can be about a hotel offer or a flight offer.
alter table messages alter column offer_id drop not null;
alter table messages add column flight_offer_id uuid references flight_offers(id) on delete cascade;
alter table messages add constraint messages_one_offer check ((offer_id is null) <> (flight_offer_id is null));
create index messages_flight_offer on messages (flight_offer_id, created_at);

-- ───────────── Helpers ─────────────
-- A hotel or office sees a request once it was routed to it.
create or replace function request_routed_to_me(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from offers o where o.request_id = r and o.hotel_id in (select my_orgs()))
      or exists (select 1 from flight_offers f where f.request_id = r and f.agency_id in (select my_orgs()))
$$;

-- Flight offers the campaign may see: never drafts or declined ones.
create or replace function flight_offer_visible(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from flight_offers x join group_requests g on g.id = x.request_id
     where x.id = o
       and (x.agency_id in (select my_orgs())
            or (x.status in ('sent', 'accepted', 'not_chosen', 'withdrawn', 'expired') and g.campaign_id in (select my_orgs()))))
$$;

-- Some hotel or office already answered (then the trip details are frozen).
create or replace function request_answered(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from offers where request_id = r and status <> 'draft')
      or exists (select 1 from flight_offers where request_id = r and status <> 'draft')
$$;

-- Every city has a booked hotel and every flight a booked office.
create or replace function request_fully_booked(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from request_stays s where s.request_id = r
                       and not exists (select 1 from offer_lines l join offers x on x.id = l.offer_id
                                        where l.stay_id = s.id and x.status = 'accepted'))
     and not exists (select 1 from request_flights f where f.request_id = r
                       and not exists (select 1 from flight_offer_lines l join flight_offers x on x.id = l.offer_id
                                        where l.flight_id = f.id and x.status = 'accepted'))
$$;

create or replace function fee_setting(k text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::bigint from app_settings where key = k), 0)
$$;

-- ───────────── Sign-up: campaigns are active at once; hotels and offices wait for checking ─────────────
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
          case when p_kind::text = 'hotel' then 'IQ' else upper(coalesce(nullif(trim(p_country), ''), 'OM')) end,
          nullif(trim(p_city), ''),
          case when p_kind::text = 'campaign' then 'active'::org_status else 'pending'::org_status end)
  returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into audit_log (actor, org_id, entity, entity_id, action) values (v_uid, v_org, 'organization', v_org, 'create');
  return v_org;
end $$;

create or replace function guard_agency_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind::text from organizations where id = new.org_id) <> 'agency' then
    raise exception 'only a flight office has an office profile';
  end if;
  new.about := mask_contacts(new.about);
  new.countries := coalesce((select array_agg(distinct upper(c)) from unnest(new.countries) c where c ~* '^[a-z]{2}$'), '{}');
  new.updated_at := now();
  if not is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.license_no is distinct from old.license_no then
      new.verified := false;
    elsif new.verified is distinct from old.verified then
      raise exception 'only an admin can verify an office';
    end if;
  end if;
  return new;
end $$;
create trigger agency_profiles_guard before insert or update on agency_profiles for each row execute function guard_agency_profile();

-- ───────────── Requests: frozen once anyone answered (hotel or office) ─────────────
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
  if request_answered(old.id)
     and (new.pilgrims, new.meal, new.min_stars, new.max_distance_m, new.respond_by)
         is distinct from (old.pilgrims, old.meal, old.min_stars, old.max_distance_m, old.respond_by) then
    raise exception 'hotels already answered this request; cancel it and send a new one';
  end if;
  return new;
end $$;

create or replace function guard_stay() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req uuid := coalesce(new.request_id, old.request_id);
begin
  if is_admin() or is_internal() then return coalesce(new, old); end if;
  if (select status from group_requests where id = v_req) <> 'open' or request_answered(v_req) then
    raise exception 'stays can no longer be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger request_flights_guard before insert or update or delete on request_flights for each row execute function guard_stay();

-- Sends the request to every verified, active hotel in its cities and every verified, active office
-- serving the campaign's country. Each gets an empty draft offer. Safe to call again.
create or replace function dispatch_request(p_request uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r group_requests; n_hotels int := 0; n_offices int := 0;
begin
  select * into r from group_requests where id = p_request;
  if r.id is null then raise exception 'request not found'; end if;
  if not (is_member(r.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if r.status <> 'open' then raise exception 'request is %', r.status; end if;
  if not exists (select 1 from request_stays where request_id = r.id)
     and not exists (select 1 from request_flights where request_id = r.id) then
    raise exception 'add at least one city or flight';
  end if;

  insert into offers (request_id, hotel_id, meal)
  select r.id, h.org_id, r.meal
    from hotel_profiles h join organizations o on o.id = h.org_id
   where o.kind = 'hotel' and o.status = 'active' and h.verified
     and h.city in (select city from request_stays where request_id = r.id)
     and h.stars >= coalesce(r.min_stars, 1)
     and (r.max_distance_m is null or h.distance_to_shrine_m <= r.max_distance_m)
  on conflict (request_id, hotel_id) do nothing;
  get diagnostics n_hotels = row_count;

  if exists (select 1 from request_flights where request_id = r.id) then
    insert into flight_offers (request_id, agency_id)
    select r.id, a.org_id
      from agency_profiles a join organizations o on o.id = a.org_id
     where o.kind::text = 'agency' and o.status = 'active' and a.verified
       and (a.countries = '{}' or r.from_country = any (a.countries))
    on conflict (request_id, agency_id) do nothing;
    get diagnostics n_offices = row_count;
  end if;

  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), r.campaign_id, 'request', r.id, 'dispatch', jsonb_build_object('hotels', n_hotels, 'offices', n_offices));
  return n_hotels + n_offices;
end $$;

-- ───────────── Flight offers: the same locks as hotel offers ─────────────
create or replace function guard_flight_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare r group_requests;
begin
  if tg_op = 'INSERT' then
    new.status := 'draft'; new.total_minor := 0; new.sent_at := null;
    return new;
  end if;
  new.notes := mask_contacts(new.notes);
  if is_admin() or is_internal() then return new; end if;
  if new.request_id is distinct from old.request_id or new.agency_id is distinct from old.agency_id then
    raise exception 'not allowed';
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    return new;
  elsif old.status = 'draft' and new.status = 'sent' then
    select * into r from group_requests where id = old.request_id;
    if r.status <> 'open' then raise exception 'request is % and can no longer get offers', r.status; end if;
    if r.respond_by < now() then raise exception 'the time to answer this request has passed'; end if;
    if (select status from organizations where id = old.agency_id) <> 'active' then raise exception 'office account is not active yet'; end if;
    if not exists (select 1 from flight_offer_lines where offer_id = old.id) then raise exception 'add at least one flight price'; end if;
    new.total_minor := (select sum(line_total_minor) from flight_offer_lines where offer_id = old.id);
    new.snap_country := (select country from organizations where id = old.agency_id);
    new.sent_at := now();
    insert into audit_log (actor, org_id, entity, entity_id, action, detail)
    values (auth.uid(), old.agency_id, 'flight_offer', old.id, 'send', jsonb_build_object('total_minor', new.total_minor, 'currency', new.currency));
    return new;
  elsif old.status = 'draft' and new.status = 'declined' then
    return new;
  elsif old.status = 'sent' and new.status = 'withdrawn'
        and (select status from group_requests where id = old.request_id) = 'open' then
    return new;
  elsif old.status = 'sent' and new.status = 'sent'
        and (new.total_minor, new.currency, new.valid_until, new.sent_at, new.snap_country)
            is not distinct from (old.total_minor, old.currency, old.valid_until, old.sent_at, old.snap_country) then
    return new;                                   -- notes only
  end if;
  raise exception 'offer is % and can no longer be changed', old.status;
end $$;
create trigger flight_offers_guard before insert or update on flight_offers for each row execute function guard_flight_offer();

create or replace function guard_flight_offer_line() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_offer uuid := coalesce(new.offer_id, old.offer_id); o flight_offers;
begin
  select * into o from flight_offers where id = v_offer;
  if not (is_admin() or is_internal()) and o.status <> 'draft' then
    raise exception 'offer is % and can no longer be changed', o.status;
  end if;
  if tg_op <> 'DELETE' and (select request_id from request_flights where id = new.flight_id) is distinct from o.request_id then
    raise exception 'that flight is not part of this request';
  end if;
  return coalesce(new, old);
end $$;
create trigger flight_offer_lines_guard before insert or update or delete on flight_offer_lines for each row execute function guard_flight_offer_line();

-- ───────────── Booking: fee instead of commission ─────────────
-- The campaign books a hotel offer. Fee = pilgrims × fee_per_pilgrim_hotel_minor, due when the hotel confirms.
create or replace function accept_offer(p_offer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o offers; r group_requests; v_booking uuid; v_fee bigint;
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

  v_fee := r.pilgrims * fee_setting('fee_per_pilgrim_hotel_minor');
  perform internal_on();
  update offers set status = 'accepted' where id = o.id;
  update offers x set status = 'not_chosen'
   where x.request_id = r.id and x.id <> o.id and x.status = 'sent'
     and exists (select 1 from offer_lines a join offer_lines b on b.stay_id = a.stay_id
                  where a.offer_id = x.id and b.offer_id = o.id);
  insert into bookings (kind, request_id, offer_id, campaign_id, hotel_id, currency, total_minor, units, fee_minor, fee_currency)
  values ('hotel', r.id, o.id, r.campaign_id, o.hotel_id, o.currency, o.total_minor, r.pilgrims, v_fee,
          coalesce((select value #>> '{}' from app_settings where key = 'fee_currency'), 'USD'))
  returning id into v_booking;
  if request_fully_booked(r.id) then update group_requests set status = 'booked' where id = r.id; end if;
  perform internal_off();
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), r.campaign_id, 'booking', v_booking, 'create', jsonb_build_object('offer', o.id, 'fee_minor', v_fee));
  return v_booking;
end $$;

-- The campaign books a flight offer. Fee = tickets × fee_per_ticket_minor (a return ticket is one).
create or replace function accept_flight_offer(p_offer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o flight_offers; r group_requests; v_booking uuid; v_tickets int; v_fee bigint;
begin
  select * into o from flight_offers where id = p_offer for update;
  if o.id is null then raise exception 'offer not found'; end if;
  select * into r from group_requests where id = o.request_id for update;
  if not (is_member(r.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if r.status <> 'open' then raise exception 'request is % and can no longer be booked', r.status; end if;
  if o.status <> 'sent' then raise exception 'only a sent offer can be booked'; end if;
  if o.valid_until is not null and o.valid_until < now() then raise exception 'this offer has expired'; end if;
  if exists (select 1 from flight_offer_lines l join flight_offer_lines a on a.flight_id = l.flight_id
               join flight_offers x on x.id = a.offer_id
              where l.offer_id = o.id and x.status = 'accepted') then
    raise exception 'a flight in this offer is already booked';
  end if;

  select coalesce(sum(seats), 0) into v_tickets from flight_offer_lines where offer_id = o.id;
  v_fee := v_tickets * fee_setting('fee_per_ticket_minor');
  perform internal_on();
  update flight_offers set status = 'accepted' where id = o.id;
  update flight_offers x set status = 'not_chosen'
   where x.request_id = r.id and x.id <> o.id and x.status = 'sent'
     and exists (select 1 from flight_offer_lines a join flight_offer_lines b on b.flight_id = a.flight_id
                  where a.offer_id = x.id and b.offer_id = o.id);
  insert into bookings (kind, request_id, flight_offer_id, campaign_id, agency_id, currency, total_minor, units, fee_minor, fee_currency)
  values ('flight', r.id, o.id, r.campaign_id, o.agency_id, o.currency, o.total_minor, v_tickets, v_fee,
          coalesce((select value #>> '{}' from app_settings where key = 'fee_currency'), 'USD'))
  returning id into v_booking;
  if request_fully_booked(r.id) then update group_requests set status = 'booked' where id = r.id; end if;
  perform internal_off();
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), r.campaign_id, 'booking', v_booking, 'create', jsonb_build_object('flight_offer', o.id, 'tickets', v_tickets, 'fee_minor', v_fee));
  return v_booking;
end $$;

-- The hotel or office confirms it holds the rooms/seats. Now the fee is due.
create or replace function confirm_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_member(b.agency_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status::text <> 'pending_hotel' then raise exception 'booking is %', b.status; end if;
  update bookings set status = 'awaiting_payment' where id = b.id;
  insert into audit_log (actor, org_id, entity, entity_id, action)
  values (auth.uid(), coalesce(b.hotel_id, b.agency_id), 'booking', b.id, 'confirm');
end $$;

-- Hamlaty records the fee as paid (by the team today; by the payment gateway later). The booking is confirmed.
create or replace function mark_fee_paid(p_booking uuid, p_reference text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  if not (is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'only Hamlaty can record a payment';
  end if;
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if b.status::text <> 'awaiting_payment' then raise exception 'booking is %', b.status; end if;
  update bookings set status = 'confirmed', confirmed_at = now(), fee_paid_at = now(),
         fee_reference = left(nullif(trim(p_reference), ''), 120)
   where id = b.id;
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), b.campaign_id, 'booking', b.id, 'fee_paid', jsonb_build_object('fee_minor', b.fee_minor, 'reference', p_reference));
end $$;

-- Either side cancels before the trip. The request opens again so the campaign can book someone else.
create or replace function cancel_booking(p_booking uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_member(b.agency_id) or is_member(b.campaign_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status::text not in ('pending_hotel', 'awaiting_payment', 'confirmed') then raise exception 'booking is %', b.status; end if;
  perform internal_on();
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid() where id = b.id;
  if b.kind = 'hotel' then update offers set status = 'withdrawn' where id = b.offer_id;
  else update flight_offers set status = 'withdrawn' where id = b.flight_offer_id; end if;
  update group_requests set status = 'open' where id = b.request_id and status = 'booked';
  perform internal_off();
  insert into audit_log (actor, org_id, entity, entity_id, action, detail)
  values (auth.uid(), null, 'booking', b.id, 'cancel', jsonb_build_object('reason', left(mask_contacts(p_reason), 500)));
end $$;

-- After the stay or flight: the provider (or Hamlaty) marks it done.
create or replace function complete_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (is_member(b.hotel_id) or is_member(b.agency_id) or is_admin()) then raise exception 'not allowed'; end if;
  if b.status <> 'confirmed' then raise exception 'booking is %', b.status; end if;
  update bookings set status = 'completed', completed_at = now() where id = b.id;
  insert into audit_log (actor, org_id, entity, entity_id, action)
  values (auth.uid(), coalesce(b.hotel_id, b.agency_id), 'booking', b.id, 'complete');
end $$;

-- Names and phones of both sides, only once the fee is paid (status confirmed or completed).
drop function if exists booking_contacts(uuid);
create or replace function booking_contacts(p_booking uuid)
returns table (provider_kind text, provider_name text, provider_phone text, provider_address text, provider_city text,
               campaign_name text, campaign_phone text, campaign_country text)
language plpgsql stable security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking;
  if b.id is null or not (is_member(b.hotel_id) or is_member(b.agency_id) or is_member(b.campaign_id) or is_admin()) then return; end if;
  if b.status not in ('confirmed', 'completed') and not is_admin() then return; end if;
  return query
    select b.kind, p.name, p.phone, hp.address, coalesce(hp.city, p.city), c.name, c.phone, c.country
      from organizations p left join hotel_profiles hp on hp.org_id = p.id, organizations c
     where p.id = coalesce(b.hotel_id, b.agency_id) and c.id = b.campaign_id;
end $$;

-- ───────────── Messages: hotel or flight offer; contacts hidden until the fee is paid ─────────────
create or replace function guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_provider uuid; v_status offer_status; v_request uuid; v_campaign uuid; v_typed text := new.body; v_open boolean;
begin
  if new.offer_id is not null then
    select hotel_id, status, request_id into v_provider, v_status, v_request from offers where id = new.offer_id;
    v_open := exists (select 1 from bookings where offer_id = new.offer_id and status in ('confirmed', 'completed'));
  else
    select agency_id, status, request_id into v_provider, v_status, v_request from flight_offers where id = new.flight_offer_id;
    v_open := exists (select 1 from bookings where flight_offer_id = new.flight_offer_id and status in ('confirmed', 'completed'));
  end if;
  select campaign_id into v_campaign from group_requests where id = v_request;
  if not is_admin() then
    if not is_member(new.sender_org) or new.sender_org not in (v_provider, v_campaign) then
      raise exception 'not allowed';
    end if;
    if new.sender_org = v_campaign and v_status = 'draft' then raise exception 'the provider has not answered yet'; end if;
    if v_status in ('declined', 'withdrawn') then raise exception 'this offer is closed'; end if;
  end if;
  new.sender_user := auth.uid();
  if not v_open then new.body := mask_contacts(v_typed); end if;
  new.masked := new.body is distinct from v_typed;
  return new;
end $$;

-- ───────────── Row Level Security for the new tables ─────────────
alter table agency_profiles    enable row level security;
alter table request_flights    enable row level security;
alter table flight_offers      enable row level security;
alter table flight_offer_lines enable row level security;

create policy agency_profiles_own on agency_profiles for all to authenticated
  using (is_member(org_id) or is_admin()) with check (is_member(org_id) or is_admin());

create policy flights_read on request_flights for select to authenticated
  using (my_request(request_id) or request_routed_to_me(request_id) or is_admin());
create policy flights_write on request_flights for all to authenticated
  using (my_request(request_id) or is_admin()) with check (my_request(request_id) or is_admin());

create policy flight_offers_read on flight_offers for select to authenticated using (flight_offer_visible(id) or is_admin());
create policy flight_offers_update on flight_offers for update to authenticated
  using (is_member(agency_id) or is_admin()) with check (is_member(agency_id) or is_admin());

create policy flight_offer_lines_read on flight_offer_lines for select to authenticated using (flight_offer_visible(offer_id) or is_admin());
create policy flight_offer_lines_write on flight_offer_lines for all to authenticated
  using (exists (select 1 from flight_offers o where o.id = offer_id and is_member(o.agency_id)) or is_admin())
  with check (exists (select 1 from flight_offers o where o.id = offer_id and is_member(o.agency_id)) or is_admin());

drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select to authenticated
  using (is_member(campaign_id) or is_member(hotel_id) or is_member(agency_id) or is_admin());

drop policy if exists messages_read on messages;
create policy messages_read on messages for select to authenticated
  using (offer_visible(offer_id) or flight_offer_visible(flight_offer_id) or is_admin());

-- ───────────── Who may call what (same rules as 0001, for the new functions too) ─────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function internal_on(), internal_off() from authenticated;
grant execute on function trip_by_code(text), register_pilgrim(text, text, text, text, int, text, text, text) to anon;
revoke all on all tables in schema public from anon;
