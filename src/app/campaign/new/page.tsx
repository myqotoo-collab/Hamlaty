"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ErrorNote } from "@/components/Shell";
import { friendlyError, supabase, tell } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { addDays, isoDay } from "@/lib/format";
import {
  FROM_AIRPORTS,
  HOLY_CITIES,
  MEAL_PLANS,
  ROOM_BEDS,
  ROOM_TYPES,
  TO_AIRPORTS,
  cityName,
  mealName,
  roomName,
  type MealPlan,
  type RoomType,
} from "@/lib/types";

interface Stay {
  city: string;
  check_in: string;
  nights: number;
  rooms: Record<RoomType, number>;
}
interface Flight {
  from_airport: string;
  to_airport: string;
  depart_on: string;
  return_on: string;
  seats: number;
  baggage_kg: number | null;
}

const num = (v: string, max = 2000) => Math.max(0, Math.min(max, Number(v.replace(/[^\d]/g, "")) || 0));

/** A campaign's group request: pilgrims, then each city with its nights and rooms, then flights. */
export default function NewRequest() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { me } = useMe("campaign");
  const [pilgrims, setPilgrims] = useState(40);
  const [meal, setMeal] = useState<MealPlan>("breakfast");
  const [minStars, setMinStars] = useState(3);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [hours, setHours] = useState(48);
  const [stays, setStays] = useState<Stay[]>([
    { city: "كربلاء", check_in: isoDay(30), nights: 3, rooms: { single: 0, double: 10, triple: 5, quad: 1 } },
  ]);
  const [withFlights, setWithFlights] = useState(true);
  const [flights, setFlights] = useState<Flight[]>([
    { from_airport: "MCT", to_airport: "NJF", depart_on: isoDay(30), return_on: isoDay(36), seats: 40, baggage_kg: 30 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A sensible first flight: from the campaign's country to Najaf.
  useEffect(() => {
    const byCountry: Record<string, string> = { OM: "MCT", KW: "KWI", BH: "BAH", QA: "DOH", AE: "DXB", SA: "RUH", LB: "BEY" };
    const from = me?.org?.country ? byCountry[me.org.country] : undefined;
    if (from) setFlights((f) => f.map((x, i) => (i === 0 ? { ...x, from_airport: from } : x)));
  }, [me?.org?.country]);

  const setStay = (i: number, patch: Partial<Stay>) => setStays((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setRooms = (i: number, r: RoomType, v: number) => setStays((s) => s.map((x, j) => (j === i ? { ...x, rooms: { ...x.rooms, [r]: v } } : x)));
  const setFlight = (i: number, patch: Partial<Flight>) => setFlights((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function addStay() {
    const last = stays[stays.length - 1];
    const next = HOLY_CITIES.find((c) => !stays.some((s) => s.city === c)) ?? HOLY_CITIES[0];
    setStays([...stays, { city: next, check_in: last ? addDays(last.check_in, last.nights) : isoDay(30), nights: 2, rooms: last ? { ...last.rooms } : { single: 0, double: 10, triple: 0, quad: 0 } }]);
  }

  const beds = (s: Stay) => ROOM_TYPES.reduce((n, r) => n + s.rooms[r] * ROOM_BEDS[r], 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.org) return;
    setError(null);
    if (pilgrims < 1) return setError(t("اكتب عدد الزوار.", "Enter the number of pilgrims."));
    const useFlights = withFlights ? flights : [];
    if (!stays.length && !useFlights.length) return setError(t("أضف مدينة أو رحلة طيران واحدة على الأقل.", "Add at least one city or flight."));
    for (const s of stays) {
      if (!s.check_in || s.check_in < isoDay(0)) return setError(t("تاريخ الوصول يجب أن يكون اليوم أو بعده.", "The check-in date must be today or later."));
      if (s.nights < 1) return setError(t("عدد الليالي يجب أن يكون ليلة واحدة على الأقل.", "Nights must be at least one."));
      if (!beds(s)) return setError(t(`أضف غرفاً لإقامة ${cityName(s.city, lang)}.`, `Add rooms for the stay in ${cityName(s.city, lang)}.`));
    }
    for (const f of useFlights) {
      if (!/^[A-Z]{3}$/.test(f.from_airport) || !/^[A-Z]{3}$/.test(f.to_airport)) return setError(t("اكتب رمز المطار من 3 أحرف إنجليزية، مثل MCT.", "Enter a 3-letter airport code, such as MCT."));
      if (!f.depart_on || f.depart_on < isoDay(0)) return setError(t("تاريخ السفر يجب أن يكون اليوم أو بعده.", "The travel date must be today or later."));
      if (f.return_on && f.return_on < f.depart_on) return setError(t("تاريخ العودة قبل تاريخ الذهاب.", "The return date is before the departure date."));
      if (f.seats < 1) return setError(t("اكتب عدد المقاعد.", "Enter the number of seats."));
    }

    setBusy(true);
    const sb = supabase();
    const { data: req, error: e1 } = await sb
      .from("group_requests")
      .insert({
        campaign_id: me.org.id,
        pilgrims,
        meal,
        min_stars: minStars,
        max_distance_m: maxDistance,
        notes: notes.trim() || null,
        respond_by: new Date(Date.now() + hours * 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (e1 || !req) {
      setBusy(false);
      return setError(friendlyError(e1, lang));
    }
    const rows = stays.map((s, i) => ({
      request_id: req.id,
      position: i + 1,
      city: s.city,
      check_in: s.check_in,
      nights: s.nights,
      rooms_single: s.rooms.single,
      rooms_double: s.rooms.double,
      rooms_triple: s.rooms.triple,
      rooms_quad: s.rooms.quad,
    }));
    const legs = useFlights.map((f, i) => ({
      request_id: req.id,
      position: i + 1,
      from_airport: f.from_airport,
      to_airport: f.to_airport,
      depart_on: f.depart_on,
      return_on: f.return_on || null,
      seats: f.seats,
      baggage_kg: f.baggage_kg,
    }));
    const r2 = rows.length ? await sb.from("request_stays").insert(rows) : { error: null };
    const r3 = !r2.error && legs.length ? await sb.from("request_flights").insert(legs) : { error: null };
    const r4 = !r2.error && !r3.error ? await sb.rpc("dispatch_request", { p_request: req.id }) : { error: null, data: null };
    const err = r2.error ?? r3.error ?? r4.error;
    if (err) {
      // Do not leave a half-made request behind.
      await sb.from("group_requests").update({ status: "cancelled" }).eq("id", req.id);
      setBusy(false);
      return setError(friendlyError(err, lang));
    }
    await tell("dispatched", req.id);
    router.replace(`/campaign/requests/${req.id}?sent=${r4.data ?? 0}`);
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{me?.org?.name}</span>
        <h1>{t("طلب مجموعة جديد", "New group request")}</h1>
        <p>{t("طلب واحد يصل إلى الفنادق الموثّقة في مدنك، ومكاتب الطيران التي تخدم دولتك.", "One request reaches the verified hotels in your cities and the flight offices serving your country.")}</p>
      </div>

      <form className="stack" onSubmit={submit}>
        <section className="panel">
          <h2>{t("المجموعة", "The group")}</h2>
          <div className="grid2">
            <label className="field" htmlFor="pilgrims">
              {t("عدد الزوار", "Pilgrims")}
              <input id="pilgrims" className="num" inputMode="numeric" value={pilgrims} onChange={(e) => setPilgrims(num(e.target.value))} />
            </label>
            <label className="field" htmlFor="meal">
              {t("الوجبات", "Meals")}
              <select id="meal" value={meal} onChange={(e) => setMeal(e.target.value as MealPlan)}>
                {MEAL_PLANS.map((m) => (
                  <option key={m} value={m}>
                    {mealName(m, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="stars">
              {t("أقل تصنيف للفندق", "Minimum hotel stars")}
              <select id="stars" value={minStars} onChange={(e) => setMinStars(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="dist">
              {t("أبعد مسافة عن الحرم", "Furthest from the shrine")}
              <select id="dist" value={maxDistance ?? ""} onChange={(e) => setMaxDistance(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t("لا يهم", "Any")}</option>
                {[200, 500, 1000, 2000].map((m) => (
                  <option key={m} value={m}>
                    {m < 1000 ? t(`${m} م`, `${m} m`) : t(`${m / 1000} كم`, `${m / 1000} km`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {stays.map((s, i) => (
          <section key={i} className="panel">
            <div className="row spread">
              <h2>{t(`الإقامة ${i + 1}`, `Stay ${i + 1}`)}</h2>
              <button type="button" className="linkish" onClick={() => setStays(stays.filter((_, j) => j !== i))}>
                {t("حذف", "Remove")}
              </button>
            </div>
            <div className="grid2">
              <label className="field" htmlFor={`city${i}`}>
                {t("المدينة", "City")}
                <select id={`city${i}`} value={s.city} onChange={(e) => setStay(i, { city: e.target.value })}>
                  {HOLY_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {cityName(c, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor={`in${i}`}>
                {t("تاريخ الوصول", "Check-in")}
                <input id={`in${i}`} type="date" min={isoDay(0)} value={s.check_in} onChange={(e) => setStay(i, { check_in: e.target.value })} />
              </label>
              <label className="field" htmlFor={`nights${i}`}>
                {t("عدد الليالي", "Nights")}
                <input id={`nights${i}`} className="num" inputMode="numeric" value={s.nights} onChange={(e) => setStay(i, { nights: num(e.target.value, 30) })} />
              </label>
            </div>
            <div className="grid2">
              {ROOM_TYPES.map((r) => (
                <label key={r} className="field" htmlFor={`r${i}${r}`}>
                  {t(`غرف ${roomName(r, lang)}`, `${roomName(r, lang)} rooms`)}
                  <input id={`r${i}${r}`} className="num" inputMode="numeric" value={s.rooms[r]} onChange={(e) => setRooms(i, r, num(e.target.value, 500))} />
                </label>
              ))}
            </div>
            <p className={`small ${beds(s) < pilgrims ? "error" : "muted"}`}>
              {t(`تكفي هذه الغرف ${beds(s)} زائراً من ${pilgrims}.`, `These rooms fit ${beds(s)} of ${pilgrims} pilgrims.`)}
            </p>
          </section>
        ))}
        <button type="button" className="btn ghost" onClick={addStay}>
          {t("+ أضف مدينة", "+ Add a city")}
        </button>

        <section className="panel">
          <label className="check">
            <input type="checkbox" checked={withFlights} onChange={(e) => setWithFlights(e.target.checked)} />
            <b>{t("أحتاج تذاكر طيران للمجموعة", "I need flight tickets for the group")}</b>
          </label>
          {withFlights &&
            flights.map((f, i) => (
              <div key={i} className="stack" style={{ borderTop: i ? "1px solid var(--line)" : undefined, paddingTop: i ? 12 : 0 }}>
                <div className="row spread">
                  <b>{t(`الرحلة ${i + 1}`, `Flight ${i + 1}`)}</b>
                  {flights.length > 1 && (
                    <button type="button" className="linkish" onClick={() => setFlights(flights.filter((_, j) => j !== i))}>
                      {t("حذف", "Remove")}
                    </button>
                  )}
                </div>
                <div className="grid2">
                  <label className="field" htmlFor={`from${i}`}>
                    {t("من مطار", "From airport")}
                    <input id={`from${i}`} className="num" list="from-airports" maxLength={3} value={f.from_airport} onChange={(e) => setFlight(i, { from_airport: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
                  </label>
                  <label className="field" htmlFor={`to${i}`}>
                    {t("إلى مطار", "To airport")}
                    <select id={`to${i}`} value={f.to_airport} onChange={(e) => setFlight(i, { to_airport: e.target.value })}>
                      {Object.entries(TO_AIRPORTS).map(([code, [ar, en]]) => (
                        <option key={code} value={code}>
                          {lang === "en" ? en : ar} ({code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" htmlFor={`dep${i}`}>
                    {t("تاريخ الذهاب", "Departure")}
                    <input id={`dep${i}`} type="date" min={isoDay(0)} value={f.depart_on} onChange={(e) => setFlight(i, { depart_on: e.target.value })} />
                  </label>
                  <label className="field" htmlFor={`ret${i}`}>
                    {t("تاريخ العودة (اختياري)", "Return (optional)")}
                    <input id={`ret${i}`} type="date" min={f.depart_on} value={f.return_on} onChange={(e) => setFlight(i, { return_on: e.target.value })} />
                  </label>
                  <label className="field" htmlFor={`seats${i}`}>
                    {t("عدد المقاعد", "Seats")}
                    <input id={`seats${i}`} className="num" inputMode="numeric" value={f.seats} onChange={(e) => setFlight(i, { seats: num(e.target.value) })} />
                  </label>
                  <label className="field" htmlFor={`bag${i}`}>
                    {t("الوزن المسموح (كغ)", "Baggage (kg)")}
                    <input id={`bag${i}`} className="num" inputMode="numeric" value={f.baggage_kg ?? ""} onChange={(e) => setFlight(i, { baggage_kg: e.target.value ? num(e.target.value, 100) : null })} />
                  </label>
                </div>
              </div>
            ))}
          {withFlights && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setFlights([...flights, { ...flights[flights.length - 1], seats: pilgrims } as Flight])}
              style={{ justifySelf: "start" }}
            >
              {t("+ أضف رحلة", "+ Add a flight")}
            </button>
          )}
          <datalist id="from-airports">
            {Object.entries(FROM_AIRPORTS).map(([code, [ar, en]]) => (
              <option key={code} value={code}>
                {lang === "en" ? en : ar}
              </option>
            ))}
          </datalist>
        </section>

        <section className="panel">
          <label className="field" htmlFor="notes">
            {t("ملاحظات للفنادق والمكاتب", "Notes for hotels and offices")}
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("كبار سن، مصعد، قرب المطعم… (أرقام الهواتف تُخفى تلقائياً)", "Elderly pilgrims, a lift, near a restaurant… (phone numbers are hidden automatically)")} />
          </label>
          <label className="field" htmlFor="hours">
            {t("مهلة الرد على الطلب", "Time for offers")}
            <select id="hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              <option value={24}>{t("24 ساعة", "24 hours")}</option>
              <option value={48}>{t("48 ساعة", "48 hours")}</option>
              <option value={72}>{t("3 أيام", "3 days")}</option>
              <option value={168}>{t("أسبوع", "One week")}</option>
            </select>
          </label>
          <ErrorNote text={error} />
          <button className="btn" disabled={busy}>
            {busy ? t("جارٍ الإرسال…", "Sending…") : t("أرسل الطلب", "Send the request")}
          </button>
        </section>
      </form>
    </Shell>
  );
}
