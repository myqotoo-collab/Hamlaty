-- Hamlaty security and business-rule checks, end to end: sign-up → hotel check → request → offers →
-- booking → contacts → completion and credit → repeat-booking commission → pilgrim registration.
-- Each check raises an exception when a rule is broken; success prints PASS lines.
--   createdb hamlaty_test && psql -d hamlaty_test -f supabase/tests/_supabase_stub.sql \
--     -f supabase/migrations/0001_init.sql -f supabase/tests/rls_test.sql
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

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select status = 'active' and country = 'OM' from organizations where id = :'c1'), 'a campaign is active at once, country stored as ISO code');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select status = 'pending' and country = 'IQ' from organizations where id = :'h1'), 'a hotel waits for Hamlaty to check it');
select pg_temp.refused(format('update organizations set status = %L where id = %L', 'active', :'h1'), 'only an admin', 'a hotel cannot activate itself');

-- ── Hotel profiles ──
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

-- ── Hamlaty checks the hotels (needs the authenticator-app level) ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.check((select count(*) from organizations) = 0, 'an admin without the app code is an ordinary user');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
update organizations set status = 'active' where id in (:'h1', :'h2', :'h3');
update hotel_profiles set verified = true where org_id in (:'h1', :'h2', :'h3', :'h4');
select pg_temp.check((select count(*) from organizations) = 6, 'an admin with the app code sees every business');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update hotel_profiles set stars = 5 where org_id = :'h2';
select pg_temp.check((select not verified from hotel_profiles where org_id = :'h2'), 'changing stars sends the hotel back for checking');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
update hotel_profiles set verified = true, stars = 3 where org_id = :'h2';

-- ── A group request: Karbala 3 nights, then Najaf 2 nights ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into group_requests (campaign_id, pilgrims, meal, min_stars, notes)
values (:'c1', 45, 'half_board', 3, 'للتواصل 92345678 أو abc@mail.com') returning id as r1 \gset
insert into request_stays (request_id, position, city, check_in, nights, rooms_double, rooms_triple) values
 (:'r1', 1, 'كربلاء', current_date + 60, 3, 15, 5),
 (:'r1', 2, 'النجف',  current_date + 63, 2, 15, 5);
select id as s1 from request_stays where request_id = :'r1' and position = 1 \gset
select id as s2 from request_stays where request_id = :'r1' and position = 2 \gset
select pg_temp.check((select notes not like '%9234%' and notes not like '%@mail%' and from_country = 'OM' from group_requests where id = :'r1'), 'contacts in request notes are hidden; hotels see only the country');
select pg_temp.check(dispatch_request(:'r1') = 3, 'request goes to the 3 active, checked hotels in its cities (not the pending one)');
select pg_temp.check((select count(*) from offers) = 0, 'the campaign sees no offer while hotels are still drafting');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from group_requests) = 0, 'another campaign cannot see the request');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from group_requests) = 0, 'a hotel not yet active gets no requests');

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

-- ── The campaign compares and books ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from offers) = 3, 'the campaign sees the 3 sent offers');
select pg_temp.check((select count(*) from organizations where kind = 'hotel') = 0, 'the campaign cannot see the hotels'' names before booking');
insert into messages (offer_id, sender_org, body) values (:'o1', :'c1', 'هل يوجد مصعد؟ رقمي +968 9234 5678');
select pg_temp.check((select masked and body not like '%9234%' from messages where offer_id = :'o1'), 'a phone number in a chat message is hidden before booking');

select accept_offer(:'o1') as b1 \gset
select pg_temp.check((select commission_pct = 5 and commission_minor = round(total_minor * 0.05) and status = 'pending_hotel' from bookings where id = :'b1'), 'first booking with this hotel: 5% commission');
select pg_temp.check((select status = 'not_chosen' from offers where id = :'o2'), 'the other Karbala offer is set aside');
select pg_temp.check((select status = 'open' from group_requests where id = :'r1'), 'the request stays open until Najaf is booked too');
select pg_temp.refused(format('select accept_offer(%L)', :'o2'), 'only a sent offer', 'a set-aside offer cannot be booked');
select pg_temp.check((select count(*) from booking_contacts(:'b1')) = 0, 'no contacts before the hotel confirms');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.refused(format('select accept_offer(%L)', :'o1'), 'not allowed|only a sent offer', 'a hotel cannot book for the campaign');
select confirm_booking(:'b1');
select pg_temp.check((select campaign_name = 'حملة النور' from booking_contacts(:'b1')), 'after confirming, the hotel sees the campaign');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select hotel_name = 'فندق أ' and hotel_city = 'كربلاء' from booking_contacts(:'b1')), 'after confirming, the campaign sees the hotel');
insert into messages (offer_id, sender_org, body) values (:'o1', :'c1', 'رقمي 92345678');
select pg_temp.check((select not masked from messages where offer_id = :'o1' order by id desc limit 1), 'after the booking is confirmed, numbers are no longer hidden');

select accept_offer(:'o3') as b3 \gset
select pg_temp.check((select status = 'booked' from group_requests where id = :'r1'), 'the request is booked once every city is booked');
select pg_temp.refused(format('update group_requests set pilgrims = 50 where id = %L', :'r1'), 'can no longer be changed', 'a booked request cannot be edited');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from bookings) = 0 and (select count(*) from booking_contacts(:'b1')) = 0, 'another campaign sees no bookings or contacts');

-- ── After the stay: completion and credit ──
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select complete_booking(:'b1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select sum(amount_minor) = (select round(total_minor * 0.01) from bookings where id = :'b1') from campaign_credits), 'the campaign earns 1% credit on a completed booking');

-- ── The same campaign books the same hotel again: lower commission ──
insert into group_requests (campaign_id, pilgrims) values (:'c1', 20) returning id as r2 \gset
insert into request_stays (request_id, position, city, check_in, nights, rooms_double) values (:'r2', 1, 'كربلاء', current_date + 120, 2, 10);
select id as s21 from request_stays where request_id = :'r2' \gset
select dispatch_request(:'r2');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select id as o21 from offers where request_id = :'r2' and hotel_id = :'h1' \gset
insert into offer_lines (offer_id, stay_id, room_type, rooms, nights, rate_minor) values (:'o21', :'s21', 'double', 10, 2, 6000);
update offers set status = 'sent' where id = :'o21';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select accept_offer(:'o21') as b21 \gset
select pg_temp.check((select commission_pct = 2 from bookings where id = :'b21'), 'second booking with the same hotel: 2% commission');

-- ── Cancelling reopens the request ──
select cancel_booking(:'b21', 'تغيير الموعد');
select pg_temp.check((select status = 'open' from group_requests where id = :'r2') and (select status = 'withdrawn' from offers where id = :'o21'), 'a cancelled booking reopens the request');

-- ── Pilgrims register themselves from the campaign''s link ──
insert into trips (campaign_id, name, starts_on, ends_on) values (:'c1', 'زيارة الأربعين', current_date + 60, current_date + 66) returning join_code as code \gset
reset role;
set local role anon;
select pg_temp.as_user('');
select pg_temp.check((select trip_name = 'زيارة الأربعين' and campaign_name = 'حملة النور' from trip_by_code(:'code')), 'a visitor with the link sees the trip and campaign name');
select register_pilgrim(:'code', 'علي حسن', '96890000001', 'm', 1960, 'عُماني', 'a1234567') is not null;
select pg_temp.refused('select count(*) from pilgrims', 'permission denied|row-level', 'a visitor cannot read the pilgrim list');
select pg_temp.refused(format('select accept_offer(%L)', :'o2'), 'permission denied', 'a visitor cannot call booking functions');
select pg_temp.refused(format('select register_pilgrim(%L, %L)', 'wrongcode', 'x y'), 'not valid', 'a wrong link is refused');
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) = 1 and min(passport_no) = 'A1234567' from pilgrims), 'the campaign sees its pilgrim');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from pilgrims) = 0 and (select count(*) from trips) = 0, 'another campaign sees no trips or pilgrims');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from pilgrims) = 0, 'hotels cannot see pilgrims');
select pg_temp.check((select count(*) from audit_log) = 0, 'only admins read the audit log');

select 'ALL CHECKS PASSED';
rollback;
