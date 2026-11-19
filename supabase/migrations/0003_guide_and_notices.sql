-- Hamlaty 0003 — the pilgrims' guide, fee payment instructions, and the fee-due text message.
-- Run once in the Supabase SQL Editor, after 0002_fees_and_flights.sql.

-- ───────────── Pilgrims' guide: shrines, sites, markets, restaurants, ziyarat programmes ─────────────
-- Anyone can read the active entries (the guide is public, for pilgrims without an account);
-- only the Hamlaty team adds or edits them.
create table places (
  id          uuid primary key default gen_random_uuid(),
  city        text not null check (holy_city_ok(city)),
  category    text not null check (category in ('shrine', 'site', 'market', 'restaurant', 'program')),
  name_ar     text not null check (length(trim(name_ar)) between 2 and 120),
  name_en     text check (length(name_en) <= 120),
  about_ar    text check (length(about_ar) <= 2000),
  about_en    text check (length(about_en) <= 2000),
  address     text check (length(address) <= 300),
  hours       text check (length(hours) <= 200),
  map_url     text check (map_url is null or map_url ~ '^https://'),
  featured    boolean not null default false,
  active      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index places_city on places (city, category, position);

alter table places enable row level security;
create policy places_public on places for select to anon, authenticated using (active);
create policy places_admin on places for all to authenticated using (is_admin()) with check (is_admin());
revoke all on places from anon;
grant select on places to anon;   -- read only; Supabase gives new tables full rights by default

-- The main shrines, so the guide is not empty on day one. Markets, restaurants and programmes are added by the team.
insert into places (city, category, name_ar, name_en, featured, position) values
  ('كربلاء',   'shrine', 'حرم الإمام الحسين (ع)',        'Imam Hussain Shrine',   true, 1),
  ('كربلاء',   'shrine', 'حرم أبي الفضل العباس (ع)',     'Al-Abbas Shrine',       true, 2),
  ('النجف',    'shrine', 'حرم الإمام علي (ع)',           'Imam Ali Shrine',       true, 1),
  ('النجف',    'site',   'مقبرة وادي السلام',            'Wadi al-Salam Cemetery', false, 2),
  ('النجف',    'site',   'مسجد الكوفة',                  'Great Mosque of Kufa',  false, 3),
  ('الكاظمية', 'shrine', 'حرم الإمامين الكاظمين (ع)',     'Al-Kadhimiya Shrine',   true, 1),
  ('سامراء',   'shrine', 'حرم الإمامين العسكريين (ع)',    'Al-Askari Shrine',      true, 1);

-- ───────────── How a campaign pays the fee (edit the text here when the bank account is ready) ─────────────
insert into app_settings (key, value) values
  ('fee_payment_instructions', jsonb_build_object(
     'ar', 'حوّل رسوم حملتي إلى حساب حملتي البنكي، ثم أرسل صورة التحويل مع رقم الحجز إلى support@hamlaty.co. يتأكد الحجز فور استلامها.',
     'en', 'Transfer the Hamlaty fee to Hamlaty''s bank account, then send the transfer receipt with the booking number to support@hamlaty.co. The booking is confirmed as soon as it arrives.'))
on conflict (key) do nothing;

-- ───────────── Text messages: add the "fee due" message ─────────────
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('new_request', 'offer_sent', 'offer_accepted', 'fee_due', 'booking_confirmed', 'booking_cancelled', 'message'));

-- ───────────── Same call rules as before, for anything new ─────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function internal_on(), internal_off() from authenticated;
grant execute on function trip_by_code(text), register_pilgrim(text, text, text, text, int, text, text, text) to anon;
grant execute on function holy_city_ok(text) to anon;  -- used by the places table check
