"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { Chat } from "@/components/Chat";
import { BookingPanel, type ProviderBooking } from "@/components/BookingPanel";
import { friendlyError, supabase, tell } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { fmtDate, fmtDateTime, fromMinor, money, toMinor } from "@/lib/format";
import { MEAL_PLANS, OFFER_CURRENCIES, ROOM_TYPES, cityName, countryName, mealName, offerStatus, roomName, type RoomType } from "@/lib/types";

interface Stay { id: string; position: number; city: string; check_in: string; nights: number; rooms_single: number; rooms_double: number; rooms_triple: number; rooms_quad: number }
interface Offer {
  id: string; status: string; currency: string; total_minor: number; meal: string | null; valid_until: string | null; notes: string | null; request_id: string;
  lines: { stay_id: string; room_type: RoomType; rooms: number; nights: number; rate_minor: number }[];
}
interface Req { ref: string; status: string; pilgrims: number; meal: string; from_country: string | null; respond_by: string; notes: string | null; stays: Stay[] }
type Price = { rooms: string; nights: string; rate: string };

const key = (stay: string, room: RoomType) => `${stay}:${room}`;

/** A hotel prices a routed request (only the stays in its city), sends it, and handles the booking. */
export default function HotelOffer() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { me } = useMe("hotel");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [booking, setBooking] = useState<ProviderBooking | null>(null);
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [currency, setCurrency] = useState("USD");
  const [meal, setMeal] = useState<string>("breakfast");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!me?.org) return;
    const sb = supabase();
    const [o, h, b] = await Promise.all([
      sb.from("offers").select("*, lines:offer_lines(*)").eq("id", id).maybeSingle(),
      sb.from("hotel_profiles").select("city").eq("org_id", me.org.id).maybeSingle(),
      sb.from("bookings").select("id, ref, status, currency, total_minor, units, fee_minor, fee_currency").eq("offer_id", id).neq("status", "cancelled").maybeSingle(),
    ]);
    if (o.error || !o.data) return setError(friendlyError(o.error ?? "offer not found", lang));
    const off = o.data as Offer;
    const r = await sb.from("group_requests").select("ref, status, pilgrims, meal, from_country, respond_by, notes, stays:request_stays(*)").eq("id", off.request_id).maybeSingle();
    if (r.error || !r.data) return setError(friendlyError(r.error ?? "request not found", lang));
    const rq = r.data as Req;
    setOffer(off);
    setReq(rq);
    setCity(h.data?.city ?? null);
    setBooking((b.data as ProviderBooking | null) ?? null);
    setCurrency(off.currency);
    setMeal(off.meal ?? rq.meal);
    setValidUntil(off.valid_until ?? "");
    setNotes(off.notes ?? "");
    const p: Record<string, Price> = {};
    for (const s of rq.stays)
      for (const room of ROOM_TYPES) {
        const line = off.lines.find((l) => l.stay_id === s.id && l.room_type === room);
        const asked = s[`rooms_${room}`];
        if (asked > 0 || line)
          p[key(s.id, room)] = { rooms: String(line?.rooms ?? asked), nights: String(line?.nights ?? s.nights), rate: line ? fromMinor(line.rate_minor, off.currency) : "" };
      }
    setPrices(p);
  }, [id, me?.org, lang]);

  useEffect(() => {
    load();
  }, [load]);

  if (!offer || !req) return <Shell me={me}>{error ? <ErrorNote text={error} /> : <Loading />}</Shell>;

  const stays = [...req.stays].sort((a, b) => a.position - b.position);
  const mine = stays.filter((s) => s.city === city);
  const draft = offer.status === "draft";
  const setPrice = (k: string, patch: Partial<Price>) => setPrices((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  // What the total will be, shown as the hotel types (the database computes the real total on sending).
  const lines = mine.flatMap((s) =>
    ROOM_TYPES.filter((room) => prices[key(s.id, room)]).map((room) => {
      const p = prices[key(s.id, room)];
      return { stay_id: s.id, room_type: room, rooms: Number(p.rooms) || 0, nights: Number(p.nights) || 0, rate_minor: toMinor(p.rate, currency) };
    }),
  );
  const priced = lines.filter((l) => l.rooms > 0 && l.nights > 0 && l.rate_minor);
  const estimate = priced.reduce((n, l) => n + l.rooms * l.nights * (l.rate_minor ?? 0), 0);

  async function save(send: boolean) {
    if (!offer) return;
    setError(null);
    setSaved(false);
    if (send && !priced.length) return setError(t("أضف سعر غرفة واحدة على الأقل.", "Add at least one room price."));
    setBusy(true);
    const sb = supabase();
    const del = await sb.from("offer_lines").delete().eq("offer_id", offer.id);
    const ins = del.error || !priced.length ? { error: del.error } : await sb.from("offer_lines").insert(priced.map((l) => ({ offer_id: offer.id, ...l })));
    const upd = ins.error
      ? { error: ins.error }
      : await sb.from("offers").update({ currency, meal, valid_until: validUntil || null, notes: notes.trim() || null, ...(send ? { status: "sent" } : {}) }).eq("id", offer.id);
    setBusy(false);
    if (upd.error) return setError(friendlyError(upd.error, lang));
    if (send) await tell("offer_sent", offer.id);
    setSaved(!send);
    load();
  }

  async function setStatus(status: "declined" | "withdrawn") {
    if (!offer) return;
    setBusy(true);
    const { error } = await supabase().from("offers").update({ status }).eq("id", offer.id);
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    load();
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">
          <Link href="/hotel">{t("الطلبات الواردة", "Incoming requests")}</Link> · <span className="num">{req.ref}</span>
        </span>
        <h1>{offerStatus(offer.status, lang)}</h1>
        <p>
          {t(`حملة من ${countryName(req.from_country, lang)} · ${req.pilgrims} زائراً · ${mealName(req.meal, lang)}`, `A campaign from ${countryName(req.from_country, lang)} · ${req.pilgrims} pilgrims · ${mealName(req.meal, lang)}`)}
        </p>
      </div>
      <ErrorNote text={error} />

      {booking && me?.org && <BookingPanel booking={booking} onChange={load} />}

      <section className="panel">
        <h2>{t("الإقامة المطلوبة", "Requested stay")}</h2>
        <ul className="list">
          {stays.map((s) => (
            <li key={s.id} className="req-row" style={{ opacity: s.city === city ? 1 : 0.55 }}>
              <b>
                {cityName(s.city, lang)} · {fmtDate(s.check_in, lang)} · {t(`${s.nights} ليالٍ`, `${s.nights} nights`)}
              </b>
              <span className="small muted">
                {ROOM_TYPES.filter((r) => s[`rooms_${r}`] > 0).map((r) => `${s[`rooms_${r}`]} ${roomName(r, lang)}`).join("، ")}
                {s.city !== city && t(" · ليست في مدينتك", " · not in your city")}
              </span>
            </li>
          ))}
        </ul>
        {req.notes && <p className="small" style={{ whiteSpace: "pre-wrap" }}>{t("ملاحظات الحملة: ", "Campaign notes: ")}{req.notes}</p>}
        {draft && <p className="small muted">{t("الرد قبل ", "Reply by ")}{fmtDateTime(req.respond_by, lang)}</p>}
      </section>

      {draft && req.status === "open" ? (
        <section className="panel">
          <h2>{t("عرضك", "Your offer")}</h2>
          <div className="grid2">
            <label className="field" htmlFor="cur">
              {t("العملة", "Currency")}
              <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {OFFER_CURRENCIES.filter((c) => c === "USD" || c === "IQD").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="meal">
              {t("الوجبات في السعر", "Meals included")}
              <select id="meal" value={meal} onChange={(e) => setMeal(e.target.value)}>
                {MEAL_PLANS.map((m) => (
                  <option key={m} value={m}>{mealName(m, lang)}</option>
                ))}
              </select>
            </label>
          </div>
          {!mine.length && <p className="small error">{t("لا توجد إقامة في مدينتك في هذا الطلب.", "There is no stay in your city in this request.")}</p>}
          {mine.map((s) => (
            <div key={s.id} className="stack" style={{ gap: 8 }}>
              <b className="small">{cityName(s.city, lang)} · {fmtDate(s.check_in, lang)}</b>
              {ROOM_TYPES.filter((room) => prices[key(s.id, room)]).map((room) => {
                const p = prices[key(s.id, room)];
                return (
                  <div key={room} className="grid2" style={{ alignItems: "end" }}>
                    <label className="field">
                      {t(`غرف ${roomName(room, lang)}`, `${roomName(room, lang)} rooms`)}
                      <input className="num" inputMode="numeric" value={p.rooms} onChange={(e) => setPrice(key(s.id, room), { rooms: e.target.value.replace(/\D/g, "") })} />
                    </label>
                    <label className="field">
                      {t("الليالي", "Nights")}
                      <input className="num" inputMode="numeric" value={p.nights} onChange={(e) => setPrice(key(s.id, room), { nights: e.target.value.replace(/\D/g, "") })} />
                    </label>
                    <label className="field">
                      {t(`سعر الغرفة لليلة (${currency})`, `Rate per room per night (${currency})`)}
                      <input className="num" inputMode="decimal" value={p.rate} onChange={(e) => setPrice(key(s.id, room), { rate: e.target.value })} />
                    </label>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="grid2">
            <label className="field" htmlFor="valid">
              {t("العرض صالح حتى", "Offer valid until")}
              <input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
          </div>
          <label className="field" htmlFor="notes">
            {t("ملاحظات للحملة", "Notes for the campaign")}
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("شروط العربون والإلغاء، المصعد، الإطلالة… (أرقام الهواتف تُخفى)", "Deposit and cancellation terms, lift, view… (phone numbers are hidden)")} />
          </label>
          <p>
            <b>{t("الإجمالي: ", "Total: ")}</b>
            <b className="num">{money(estimate, currency, lang)}</b>
          </p>
          <p className="small muted">
            {t("لا يمكن تعديل الأسعار بعد الإرسال. رسوم حملتي (1$ عن كل زائر) تُقتطع من العربون عند الحجز فقط.", "Prices can't change once sent. Hamlaty's fee ($1 per pilgrim) comes out of the deposit, only if booked.")}
          </p>
          {saved && <p className="ok-note">{t("حُفظت المسودة.", "Draft saved.")}</p>}
          <div className="row">
            <button type="button" className="btn" disabled={busy || !mine.length} onClick={() => save(true)}>{t("أرسل العرض", "Send offer")}</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => save(false)}>{t("حفظ كمسودة", "Save draft")}</button>
            <button type="button" className="linkish" disabled={busy} onClick={() => setStatus("declined")}>{t("اعتذار", "Decline")}</button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="row spread">
            <h2>{t("عرضك", "Your offer")}</h2>
            <b className="num">{money(offer.total_minor, offer.currency, lang)}</b>
          </div>
          <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
            {offer.lines.map((l, i) => (
              <li key={i}>{t(`${l.rooms} غرفة ${roomName(l.room_type, lang)} × ${l.nights} ليالٍ × ${money(l.rate_minor, offer.currency, lang)}`, `${l.rooms} ${roomName(l.room_type, lang)} × ${l.nights} nights × ${money(l.rate_minor, offer.currency, lang)}`)}</li>
            ))}
          </ul>
          {offer.meal && <p className="small muted">{mealName(offer.meal, lang)}</p>}
          {offer.status === "sent" && req.status === "open" && !booking && (
            <button type="button" className="linkish" disabled={busy} onClick={() => setStatus("withdrawn")}>{t("سحب العرض", "Withdraw offer")}</button>
          )}
        </section>
      )}

      {offer.status !== "declined" && offer.status !== "withdrawn" && me?.org && (
        <section className="panel">
          <Chat offerId={offer.id} myOrgId={me.org.id} otherLabel={t("الحملة", "the campaign")} />
        </section>
      )}
    </Shell>
  );
}
