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
import { OFFER_CURRENCIES, airportName, countryName, offerStatus } from "@/lib/types";

interface Flight { id: string; position: number; from_airport: string; to_airport: string; depart_on: string; return_on: string | null; seats: number; baggage_kg: number | null }
interface Line { flight_id: string; airline: string; flight_no: string | null; depart_at: string | null; return_at: string | null; seats: number; fare_minor: number }
interface Offer { id: string; status: string; currency: string; total_minor: number; valid_until: string | null; notes: string | null; request_id: string; lines: Line[] }
interface Req { ref: string; status: string; pilgrims: number; from_country: string | null; respond_by: string; notes: string | null; flights: Flight[] }
type Draft = { airline: string; flight_no: string; depart_at: string; return_at: string; seats: string; fare: string; on: boolean };

// <input type="datetime-local"> works in local time without a zone.
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/** A flight office prices the flights of a routed request, sends it, and handles the booking. */
export default function AgencyOffer() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { me } = useMe("agency");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [booking, setBooking] = useState<ProviderBooking | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [currency, setCurrency] = useState("USD");
  const [holdHours, setHoldHours] = useState(72);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!me?.org) return;
    const sb = supabase();
    const [o, b] = await Promise.all([
      sb.from("flight_offers").select("*, lines:flight_offer_lines(*)").eq("id", id).maybeSingle(),
      sb.from("bookings").select("id, ref, status, currency, total_minor, units, fee_minor, fee_currency").eq("flight_offer_id", id).neq("status", "cancelled").maybeSingle(),
    ]);
    if (o.error || !o.data) return setError(friendlyError(o.error ?? "offer not found", lang));
    const off = o.data as Offer;
    const r = await sb.from("group_requests").select("ref, status, pilgrims, from_country, respond_by, notes, flights:request_flights(*)").eq("id", off.request_id).maybeSingle();
    if (r.error || !r.data) return setError(friendlyError(r.error ?? "request not found", lang));
    const rq = r.data as Req;
    setOffer(off);
    setReq(rq);
    setBooking((b.data as ProviderBooking | null) ?? null);
    setCurrency(off.currency);
    setNotes(off.notes ?? "");
    const d: Record<string, Draft> = {};
    for (const f of rq.flights) {
      const l = off.lines.find((x) => x.flight_id === f.id);
      d[f.id] = {
        on: !!l || !off.lines.length,
        airline: l?.airline ?? "",
        flight_no: l?.flight_no ?? "",
        depart_at: toLocal(l?.depart_at ?? null) || `${f.depart_on}T08:00`,
        return_at: toLocal(l?.return_at ?? null) || (f.return_on ? `${f.return_on}T08:00` : ""),
        seats: String(l?.seats ?? f.seats),
        fare: l ? fromMinor(l.fare_minor, off.currency) : "",
      };
    }
    setDrafts(d);
  }, [id, me?.org, lang]);

  useEffect(() => {
    load();
  }, [load]);

  if (!offer || !req) return <Shell me={me}>{error ? <ErrorNote text={error} /> : <Loading />}</Shell>;

  const flights = [...req.flights].sort((a, b) => a.position - b.position);
  const draft = offer.status === "draft";
  const set = (fid: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [fid]: { ...d[fid], ...patch } }));
  const lines = flights
    .filter((f) => drafts[f.id]?.on)
    .map((f) => {
      const d = drafts[f.id];
      return {
        flight_id: f.id,
        airline: d.airline.trim(),
        flight_no: d.flight_no.trim() || null,
        depart_at: fromLocal(d.depart_at),
        return_at: fromLocal(d.return_at),
        seats: Number(d.seats) || 0,
        fare_minor: toMinor(d.fare, currency),
      };
    });
  const priced = lines.filter((l) => l.airline.length >= 2 && l.seats > 0 && l.fare_minor);
  const estimate = priced.reduce((n, l) => n + l.seats * (l.fare_minor ?? 0), 0);

  async function save(send: boolean) {
    if (!offer) return;
    setError(null);
    setSaved(false);
    if (send && !priced.length) return setError(t("اكتب شركة الطيران وسعر المقعد لرحلة واحدة على الأقل.", "Enter the airline and seat fare for at least one flight."));
    setBusy(true);
    const sb = supabase();
    const del = await sb.from("flight_offer_lines").delete().eq("offer_id", offer.id);
    const ins = del.error || !priced.length ? { error: del.error } : await sb.from("flight_offer_lines").insert(priced.map((l) => ({ offer_id: offer.id, ...l })));
    const upd = ins.error
      ? { error: ins.error }
      : await sb
          .from("flight_offers")
          .update({ currency, notes: notes.trim() || null, valid_until: new Date(Date.now() + holdHours * 3600_000).toISOString(), ...(send ? { status: "sent" } : {}) })
          .eq("id", offer.id);
    setBusy(false);
    if (upd.error) return setError(friendlyError(upd.error, lang));
    if (send) await tell("flight_offer_sent", offer.id);
    setSaved(!send);
    load();
  }

  async function setStatus(status: "declined" | "withdrawn") {
    if (!offer) return;
    setBusy(true);
    const { error } = await supabase().from("flight_offers").update({ status }).eq("id", offer.id);
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    load();
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">
          <Link href="/agency">{t("طلبات الطيران", "Flight requests")}</Link> · <span className="num">{req.ref}</span>
        </span>
        <h1>{offerStatus(offer.status, lang)}</h1>
        <p>{t(`حملة من ${countryName(req.from_country, lang)} · ${req.pilgrims} زائراً`, `A campaign from ${countryName(req.from_country, lang)} · ${req.pilgrims} pilgrims`)}</p>
      </div>
      <ErrorNote text={error} />

      {booking && <BookingPanel booking={booking} onChange={load} />}

      {draft && req.status === "open" ? (
        <section className="panel">
          <h2>{t("عرضك", "Your offer")}</h2>
          <p className="small muted" style={{ margin: 0 }}>{t("الرد قبل ", "Reply by ")}{fmtDateTime(req.respond_by, lang)}</p>
          <label className="field" htmlFor="cur" style={{ maxWidth: 220 }}>
            {t("العملة", "Currency")}
            <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {OFFER_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {flights.map((f) => {
            const d = drafts[f.id];
            if (!d) return null;
            return (
              <div key={f.id} className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <label className="check">
                  <input type="checkbox" checked={d.on} onChange={(e) => set(f.id, { on: e.target.checked })} />
                  <b dir="auto">
                    {airportName(f.from_airport, lang)} → {airportName(f.to_airport, lang)} · {fmtDate(f.depart_on, lang)}
                    {f.return_on && ` ⇄ ${fmtDate(f.return_on, lang)}`} · {t(`${f.seats} مقعداً`, `${f.seats} seats`)}
                    {f.baggage_kg ? t(` · ${f.baggage_kg} كغ`, ` · ${f.baggage_kg} kg`) : ""}
                  </b>
                </label>
                {d.on && (
                  <div className="grid2">
                    <label className="field">
                      {t("شركة الطيران", "Airline")}
                      <input value={d.airline} onChange={(e) => set(f.id, { airline: e.target.value })} placeholder={t("مثال: الطيران العماني", "e.g. Oman Air")} />
                    </label>
                    <label className="field">
                      {t("رقم الرحلة", "Flight number")}
                      <input className="num" value={d.flight_no} onChange={(e) => set(f.id, { flight_no: e.target.value })} placeholder="WY 641" />
                    </label>
                    <label className="field">
                      {t("موعد الإقلاع", "Departure time")}
                      <input type="datetime-local" value={d.depart_at} onChange={(e) => set(f.id, { depart_at: e.target.value })} />
                    </label>
                    <label className="field">
                      {t("موعد العودة", "Return time")}
                      <input type="datetime-local" value={d.return_at} onChange={(e) => set(f.id, { return_at: e.target.value })} />
                    </label>
                    <label className="field">
                      {t("المقاعد", "Seats")}
                      <input className="num" inputMode="numeric" value={d.seats} onChange={(e) => set(f.id, { seats: e.target.value.replace(/\D/g, "") })} />
                    </label>
                    <label className="field">
                      {t(`سعر التذكرة (${currency})`, `Ticket fare (${currency})`)}
                      <input className="num" inputMode="decimal" value={d.fare} onChange={(e) => set(f.id, { fare: e.target.value })} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <label className="field" htmlFor="hold" style={{ maxWidth: 260 }}>
            {t("حجز المقاعد مؤقتاً لمدة", "Hold the seats for")}
            <select id="hold" value={holdHours} onChange={(e) => setHoldHours(Number(e.target.value))}>
              <option value={24}>{t("24 ساعة", "24 hours")}</option>
              <option value={72}>{t("3 أيام", "3 days")}</option>
              <option value={168}>{t("أسبوع", "One week")}</option>
            </select>
          </label>
          <label className="field" htmlFor="notes">
            {t("ملاحظات للحملة", "Notes for the campaign")}
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("الأمتعة، شروط التغيير والاسترداد… (أرقام الهواتف تُخفى)", "Baggage, change and refund rules… (phone numbers are hidden)")} />
          </label>
          <p>
            <b>{t("الإجمالي: ", "Total: ")}</b>
            <b className="num">{money(estimate, currency, lang)}</b>
          </p>
          <p className="small muted">
            {t("لا يمكن تعديل الأسعار بعد الإرسال. رسوم حملتي (3$ عن كل تذكرة) تُقتطع من العربون عند الحجز فقط.", "Prices can't change once sent. Hamlaty's fee ($3 per ticket) comes out of the deposit, only if booked.")}
          </p>
          {saved && <p className="ok-note">{t("حُفظت المسودة.", "Draft saved.")}</p>}
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>{t("أرسل العرض", "Send offer")}</button>
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
              <li key={i}>
                {l.airline} <span className="num" dir="ltr">{l.flight_no ?? ""}</span> · {t(`${l.seats} مقعداً × ${money(l.fare_minor, offer.currency, lang)}`, `${l.seats} seats × ${money(l.fare_minor, offer.currency, lang)}`)}
              </li>
            ))}
          </ul>
          {offer.valid_until && <p className="small muted">{t("المقاعد محجوزة حتى ", "Seats held until ")}{fmtDateTime(offer.valid_until, lang)}</p>}
          {offer.status === "sent" && req.status === "open" && !booking && (
            <button type="button" className="linkish" disabled={busy} onClick={() => setStatus("withdrawn")}>{t("سحب العرض", "Withdraw offer")}</button>
          )}
        </section>
      )}

      {offer.status !== "declined" && offer.status !== "withdrawn" && me?.org && (
        <section className="panel">
          <Chat flightOfferId={offer.id} myOrgId={me.org.id} otherLabel={t("الحملة", "the campaign")} />
        </section>
      )}
    </Shell>
  );
}
