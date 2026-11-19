-- Hamlaty security and business-rule checks, end to end: sign-up → checking hotels and flight offices →
-- request with cities and flights → offers → booking → fee paid → contacts → cancel → pilgrim registration.
-- Each check raises an exception when a rule is broken; success prints PASS lines.
--   createdb hamlaty_test && psql -d hamlaty_test -f supabase/tests/_supabase_stub.sql \
--     -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_fees_and_flights.sql -f supabase/migrations/0003_guide_and_notices.sql -f supabase/migrations/0004_campaign_deposit_wording.sql -f supabase/tests/rls_test.sql
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;

insert into auth.users (id, phone) values
 ('00000000-0000-0000-0000-0000000000c1', '96891111111'),  -- campaign 1 (Oman)
 ('00000000-0000-0000-0000-0000000000c2', '96550000000'),  -- campaign 2 (Kuwait)
 ('00000000-0000-0000-0000-0000000000a1', '9647700000001'), -- hotel Karbala A
 ('00000000-0000-0000-0000-0000000000a2', '9647700000002'), -- hotel Karbala B
 ('00000000-0000-0000-0000-0000000000a3', '9647700000003'), -- hotel Najaf
 ('00000000-0000-0000-0000-0000000000a4', '9647700000004'), -- hotel Karbala, not checked yet
 ('00000000-0000-0000-0000-0000000000f1', '96892222222'),  -- flight office in Oman, serves Oman
 ('00000000-0000-0000-0000-0000000000f2', '96893333333'),  -- flight office, serves all countries
 ('00000000-0000-0000-0000-0000000000f3', '96556666666'),  -- flight office, serves Kuwait only
 ('00000000-0000-0000-0000-0000000000ad', '96899999999');   -- Hamlaty admin
insert into profiles (user_id, is_admin) values ('00000000-0000-0000-0000-0000000000ad', true);

create function pg_temp.as_user(u text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, true), set_config('request.jwt.claims', json_build_object('aal', aal)::text, true); $$;
create function pg_temp.check(ok boolean, label text) returns text language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if; return 'PASS: ' || label; end $$;
-- Runs a statement that must fail with an error matching `pattern`.
create function pg_temp.refused(stmt text, pattern text, label text) returns text language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm ~* pattern then return 'PASS: ' || label; end if;
    raise exception 'FAIL: % (wrong error: %)', label, sqlerrm;
  end;
  raise exception 'FAIL: % (it was allowed)', label;
end $$;

set local role authenticated;

-- ── Sign-up ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select create_my_organization('campaign', 'حملة النور', 'om', 'مسقط') as c1 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select create_my_organization('campaign', 'حملة الكويت', 'KW') as c2 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select create_my_organization('hotel', 'فندق أ', null, 'كربلاء') as h1 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select create_my_organization('hotel', 'فندق ب', null, 'كربلاء') as h2 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select create_my_organization('hotel', 'فندق النجف', null, 'النجف') as h3 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select create_my_organization('hotel', 'فندق جديد', null, 'كربلاء') as h4 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select create_my_organization('agency', 'مكتب السفر العماني', 'OM', 'مسقط') as f1 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select create_my_organization('agency', 'مكتب الرحلات', 'OM') as f2 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select create_my_organization('agency', 'مكتب الكويت', 'KW') as f3 \gset

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select status = 'active' and country = 'OM' from organizations where id = :'c1'), 'a campaign is active at once, country stored as ISO code');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select status = 'pending' and country = 'IQ' from organizations where id = :'h1'), 'a hotel waits for Hamlaty to check it');
select pg_temp.refused(format('update organizations set status = %L where id = %L', 'active', :'h1'), 'only an admin', 'a hotel cannot activate itself');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select status = 'pending' and kind::text = 'agency' from organizations where id = :'f1'), 'a flight office waits for Hamlaty to check it');

-- ── Hotel and office profiles ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into hotel_profiles (org_id, city, stars, distance_to_shrine_m, shrine, verified, about)
values (:'h1', 'كربلاء', 4, 150, 'حرم الإمام الحسين', true, 'اتصلوا 07701234567');
select pg_temp.check((select not verified and about like '%[•••]%' from hotel_profiles where org_id = :'h1'), 'a hotel cannot verify itself, and its phone is hidden in the description');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into hotel_profiles (org_id, city, stars, distance_to_shrine_m) values (:'h2', 'كربلاء', 3, 400);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into hotel_profiles (org_id, city, stars, distance_to_shrine_m) values (:'h3', 'النجف', 4, 300);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into hotel_profiles (org_id, city, stars, distance_to_shrine_m) values (:'h4', 'كربلاء', 5, 100);
select pg_temp.check((select count(*) from hotel_profiles) = 1, 'a hotel sees only its own profile');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into agency_profiles (org_id, license_no, countries, verified, about) values (:'f1', 'OM-123', '{om}', true, 'واتساب 92345678');
select pg_temp.check((select not verified and countries = '{OM}' and about like '%[•••]%' from agency_profiles where org_id = :'f1'), 'an office cannot verify itself; countries stored as codes; phone hidden');
select pg_temp.refused(format('insert into hotel_profiles (org_id, city, stars, distance_to_shrine_m) values (%L, %L, 3, 100)', :'f1', 'كربلاء'), 'only a hotel', 'an office cannot pose as a hotel');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into agency_profiles (org_id, license_no) values (:'f2', 'OM-456');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into agency_profiles (org_id, license_no, countries) values (:'f3', 'KW-1', '{KW}');

-- ── Hamlaty checks hotels and offices (needs the authenticator-app level) ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.check((select count(*) from organizations) = 0, 'an admin without the app code is an ordinary user');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
update organizations set status = 'active' where id in (:'h1', :'h2', :'h3', :'f1', :'f2', :'f3');
update hotel_profiles set verified = true where org_id in (:'h1', :'h2', :'h3', :'h4');
update agency_profiles set verified = true where org_id in (:'f1', :'f2', :'f3');
select pg_temp.check((select count(*) from organizations) = 9, 'an admin with the app code sees every business');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update hotel_profiles set stars = 5 where org_id = :'h2';
select pg_temp.check((select not verified from hotel_profiles where org_id = :'h2'), 'changing stars sends the hotel back for checking');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
update hotel_profiles set verified = true, stars = 3 where org_id = :'h2';

-- ── A group request: Karbala 3 nights, Najaf 2 nights, and a return flight Muscat ⇄ Najaf ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into group_requests (campaign_id, pilgrims, meal, min_stars, notes)
values (:'c1', 45, 'half_board', 3, 'للتواصل 92345678 أو abc@mail.com') returning id as r1 \gset
insert into request_stays (request_id, position, city, check_in, nights, rooms_double, rooms_triple) values
 (:'r1', 1, 'كربلاء', current_date + 60, 3, 15, 5),
 (:'r1', 2, 'النجف',  current_date + 63, 2, 15, 5);
insert into request_flights (request_id, position, from_airport, to_airport, depart_on, return_on, seats, baggage_kg)
values (:'r1', 1, 'MCT', 'NJF', current_date + 60, current_date + 65, 45, 30);
select id as s1 from request_stays where request_id = :'r1' and position = 1 \gset
select id as s2 from request_stays where request_id = :'r1' and position = 2 \gset
select id as fl1 from request_flights where request_id = :'r1' \gset
select pg_temp.check((select notes not like '%9234%' and notes not like '%@mail%' and from_country = 'OM' from group_requests where id = :'r1'), 'contacts in request notes are hidden; providers see only the country');
select pg_temp.check(dispatch_request(:'r1') = 5, 'request goes to the 3 checked hotels in its cities and the 2 offices serving Oman (not the pending hotel, not the Kuwait-only office)');
select pg_temp.check((select count(*) from offers) = 0 and (select count(*) from flight_offers) = 0, 'the campaign sees no offer while providers are still drafting');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from group_requests) = 0, 'another campaign cannot see the request');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from group_requests) = 0, 'a hotel not yet active gets no requests');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.check((select count(*) from group_requests) = 0, 'an office serving another country gets no requests');

-- ── Hotel A (Karbala) answers ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from group_requests) = 1 and (select count(*) from request_stays) = 2, 'hotel A sees the routed request and its stays');
select pg_temp.check((select count(*) from organizations where id = :'c1') = 0, 'hotel A cannot see which campaign it is');
select id as o1 from offers where hotel_id = :'h1' \gset
insert into offer_lines (offer_id, stay_id, room_type, rooms, nights, rate_minor) values
 (:'o1', :'s1', 'double', 15, 3, 6000),
 (:'o1', :'s1', 'triple', 5, 3, 7500);
select pg_temp.refused(format('insert into offer_lines (offer_id, stay_id, room_type, rooms, nights, rate_minor) values (%L, %L, %L, 15, 2, 5000)', :'o1', :'s2', 'double'),
  'only price stays in your city', 'a Karbala hotel cannot price the Najaf stay');
select pg_temp.refused(format('insert into offers (request_id, hotel_id) values (%L, %L)', :'r1', :'h4'), 'row-level security', 'a hotel cannot create offers by itself');
update offers set total_minor = 1, status = 'sent', snap_stars = 5, notes = 'واتساب 07801112222' where id = :'o1';
select pg_temp.check((select total_minor = 15*3*6000 + 5*3*7500 and snap_stars = 4 and snap_distance_m = 150 and notes like '%[•••]%' from offers where id = :'o1'),
  'the total and the hotel facts are set by the database, not the browser; contacts hidden in notes');
select pg_temp.refused(format('update offer_lines set rate_minor = 1 where offer_id = %L', :'o1'), 'can no longer be changed', 'prices are locked once the offer is sent');
select pg_temp.refused(format('update offers set snap_distance_m = 10 where id = %L', :'o1'), 'can no longer be changed', 'the hotel facts on a sent offer are locked');

-- ── Hotel B (Karbala) and the Najaf hotel answer ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from offers) = 1 and (select count(*) from offer_lines) = 0, 'hotel B sees only its own (empty) offer, never hotel A''s prices');
select id as o2 from offers where hotel_id = :'h2' \gset
insert into offer_lines (offer_id, stay_id, room_type, rooms, nights, rate_minor) values (:'o2', :'s1', 'double', 20, 3, 5000);
update offers set status = 'sent' where id = :'o2';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select id as o3 from offers where hotel_id = :'h3' \gset
insert into offer_lines (offer_id, stay_id, room_type, rooms, nights, rate_minor) values (:'o3', :'s2', 'double', 20, 2, 5500);
update offers set status = 'sent' where id = :'o3';

-- ── The two offices answer the flight ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from request_flights) = 1 and (select count(*) from flight_offers) = 1, 'office 1 sees the flight and only its own offer');
select pg_temp.check((select count(*) from organizations where id = :'c1') = 0, 'the office cannot see which campaign it is');
select id as fo1 from flight_offers where agency_id = :'f1' \gset
insert into flight_offer_lines (offer_id, flight_id, airline, flight_no, seats, fare_minor) values (:'fo1', :'fl1', 'Oman Air', 'WY 641', 45, 22000);
update flight_offers set total_minor = 5, status = 'sent', valid_until = now() + interval '3 days' where id = :'fo1';
select pg_temp.check((select total_minor = 45 * 22000 and snap_country = 'OM' from flight_offers where id = :'fo1'), 'the flight total is computed by the database; the campaign sees only the office''s country');
select pg_temp.refused(format('update flight_offer_lines set fare_minor = 1 where offer_id = %L', :'fo1'), 'can no longer be changed', 'flight prices are locked once sent');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) from flight_offer_lines) = 0, 'office 2 never sees office 1''s prices');
select id as fo2 from flight_offers where agency_id = :'f2' \gset
insert into flight_offer_lines (offer_id, flight_id, airline, seats, fare_minor) values (:'fo2', :'fl1', 'SalamAir', 45, 19000);
update flight_offers set status = 'sent' where id = :'fo2';

-- ── The campaign compares and books ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from offers) = 3 and (select count(*) from flight_offers) = 2, 'the campaign sees the 3 hotel offers and 2 flight offers');
select pg_temp.check((select count(*) from organizations where kind <> 'campaign') = 0, 'the campaign cannot see the providers'' names before booking');
insert into messages (offer_id, sender_org, body) values (:'o1', :'c1', 'هل يوجد مصعد؟ رقمي +968 9234 5678');
select pg_temp.check((select masked and body not like '%9234%' from messages where offer_id = :'o1'), 'a phone number in a chat message is hidden before booking');
insert into messages (flight_offer_id, sender_org, body) values (:'fo1', :'c1', 'هل الوزن 30 كغ؟ ايميلي a@b.com');
select pg_temp.check((select masked from messages where flight_offer_id = :'fo1'), 'contacts are hidden in flight chats too');

select accept_offer(:'o1') as b1 \gset
select pg_temp.check((select kind = 'hotel' and units = 45 and fee_minor = 4500 and fee_currency = 'USD' and status::text = 'pending_hotel' from bookings where id = :'b1'), 'hotel booking: fee is 1 USD × 45 pilgrims');
select pg_temp.check((select status = 'not_chosen' from offers where id = :'o2'), 'the other Karbala offer is set aside');
select pg_temp.check((select status = 'open' from group_requests where id = :'r1'), 'the request stays open until Najaf and the flight are booked too');
select pg_temp.refused(format('select accept_offer(%L)', :'o2'), 'only a sent offer', 'a set-aside offer cannot be booked');

select accept_flight_offer(:'fo2') as bf \gset
select pg_temp.check((select kind = 'flight' and units = 45 and fee_minor = 13500 from bookings where id = :'bf'), 'flight booking: fee is 3 USD × 45 tickets (a return ticket is one)');
select pg_temp.check((select status = 'not_chosen' from flight_offers where id = :'fo1'), 'the other flight offer is set aside');
select accept_offer(:'o3') as b3 \gset
select pg_temp.check((select fee_minor = 4500 from bookings where id = :'b3'), 'the second hotel also costs 1 USD per pilgrim (fee is per hotel)');
select pg_temp.check((select status = 'booked' from group_requests where id = :'r1'), 'the request is booked once every city and flight is booked');
select pg_temp.refused(format('update group_requests set pilgrims = 50 where id = %L', :'r1'), 'can no longer be changed', 'a booked request cannot be edited');

-- ── Provider confirms → fee due → Hamlaty records it → contacts shown ──
select pg_temp.refused(format('select confirm_booking(%L)', :'b1'), 'not allowed', 'the campaign cannot confirm for the hotel');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select confirm_booking(:'b1');
select pg_temp.check((select status::text = 'awaiting_payment' from bookings where id = :'b1'), 'after the hotel confirms, the fee is due');
select pg_temp.check((select count(*) from booking_contacts(:'b1')) = 0, 'no contacts while the fee is unpaid');
select pg_temp.refused(format('select mark_fee_paid(%L)', :'b1'), 'only Hamlaty', 'a hotel cannot mark the fee as paid');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.refused(format('select mark_fee_paid(%L)', :'b1'), 'only Hamlaty', 'a campaign cannot mark the fee as paid');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
select mark_fee_paid(:'b1', 'TRF-0001');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select status = 'confirmed' and fee_paid_at is not null from bookings where id = :'b1'), 'once the fee is paid, the booking is confirmed');
select pg_temp.check((select provider_name = 'فندق أ' and provider_city = 'كربلاء' from booking_contacts(:'b1')), 'the campaign now sees the hotel');
insert into messages (offer_id, sender_org, body) values (:'o1', :'c1', 'رقمي 92345678');
select pg_temp.check((select not masked from messages where offer_id = :'o1' order by id desc limit 1), 'after the fee is paid, numbers are no longer hidden');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select campaign_name = 'حملة النور' from booking_contacts(:'b1')), 'the hotel now sees the campaign');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select confirm_booking(:'bf');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
select mark_fee_paid(:'bf', 'TRF-0002');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select provider_kind = 'flight' and provider_name = 'مكتب الرحلات' from booking_contacts(:'bf')), 'after the fee, the campaign sees the flight office');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from bookings) = 0 and (select count(*) from booking_contacts(:'bf')) = 0, 'the office that was not chosen sees no booking or contacts');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from bookings) = 0 and (select count(*) from booking_contacts(:'b1')) = 0, 'another campaign sees no bookings or contacts');

-- ── After the stay ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select complete_booking(:'b1');
select pg_temp.check((select status = 'completed' from bookings where id = :'b1'), 'the hotel marks the stay completed');

-- ── Cancelling reopens the request ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select cancel_booking(:'b3', 'تغيير الموعد');
select pg_temp.check((select status = 'open' from group_requests where id = :'r1') and (select status = 'withdrawn' from offers where id = :'o3'), 'a cancelled booking reopens the request');

-- ── Pilgrims register themselves from the campaign's link ──
insert into trips (campaign_id, name, starts_on, ends_on) values (:'c1', 'زيارة الأربعين', current_date + 60, current_date + 66) returning join_code as code \gset
reset role;
set local role anon;
select pg_temp.as_user('');
select pg_temp.check((select trip_name = 'زيارة الأربعين' and campaign_name = 'حملة النور' from trip_by_code(:'code')), 'a visitor with the link sees the trip and campaign name');
select register_pilgrim(:'code', 'علي حسن', '96890000001', 'm', 1960, 'عُماني', 'a1234567') is not null;
select pg_temp.refused('select count(*) from pilgrims', 'permission denied', 'a visitor cannot read the pilgrim list');
select pg_temp.refused('select count(*) from flight_offers', 'permission denied', 'a visitor cannot read flight offers');
select pg_temp.refused(format('select accept_offer(%L)', :'o2'), 'permission denied', 'a visitor cannot call booking functions');
select pg_temp.refused(format('select register_pilgrim(%L, %L)', 'wrongcode', 'x y'), 'not valid', 'a wrong link is refused');
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) = 1 and min(passport_no) = 'A1234567' from pilgrims), 'the campaign sees its pilgrim');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from pilgrims) = 0 and (select count(*) from trips) = 0, 'another campaign sees no trips or pilgrims');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) from pilgrims) = 0, 'flight offices cannot see pilgrims');
select pg_temp.check((select count(*) from audit_log) = 0, 'only admins read the audit log');

-- ── The pilgrims' guide ──
select pg_temp.check((select count(*) >= 7 from places), 'the guide has the main shrines');
select pg_temp.refused($$insert into places (city, category, name_ar) values ('كربلاء', 'market', 'سوق')$$, 'row-level security', 'only Hamlaty adds guide entries');
select pg_temp.check((select value ? 'ar' from app_settings where key = 'fee_payment_instructions'), 'campaigns can read how to pay the fee');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into places (city, category, name_ar, active) values ('النجف', 'market', 'سوق تجريبي مخفي', false);
reset role;
set local role anon;
select pg_temp.as_user('');
select pg_temp.check((select count(*) >= 7 and bool_and(active) from places), 'visitors read the guide, never hidden entries');
select pg_temp.refused($$update places set active = false$$, 'permission denied', 'visitors cannot change the guide');
reset role;
set local role authenticated;

select 'ALL CHECKS PASSED';
rollback;
