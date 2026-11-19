"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { Chat } from "@/components/Chat";
import { friendlyError, supabase, tell } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { distance, fmtDate, fmtDateTime, intlPhone, money } from "@/lib/format";
import { airportName, bookingStatus, cityName, countryName, mealName, offerStatus, requestStatus, roomName } from "@/lib/types";

interface Stay { id: string; position: number; city: string; check_in: string; nights: number; rooms_single: number; rooms_double: number; rooms_triple: number; rooms_quad: number }
interface Flight { id: string; position: number; from_airport: string; to_airport: string; depart_on: string; return_on: string | null; seats: number; baggage_kg: number | null }
interface Req { id: string; ref: string; status: string; pilgrims: number; meal: string; respond_by: string; notes: string | null; stays: Stay[]; flights: Flight[] }
interface HotelOffer {
  id: string; status: string; currency: string; total_minor: number; meal: string | null; valid_until: string | null; notes: string | null;
  snap_city: string | null; snap_stars: number | null; snap_distance_m: number | null; snap_shrine: string | null; sent_at: string | null;
  lines: { stay_id: string; room_type: string; rooms: number; nights: number; rate_minor: number; line_total_minor: number }[];
}
interface FlightOffer {
  id: string; status: string; currency: string; total_minor: number; valid_until: string | null; notes: string | null; snap_country: string | null; sent_at: string | null;
  lines: { flight_id: string; airline: string; flight_no: string | null; depart_at: string | null; return_at: string | null; seats: number; fare_minor: number; line_total_minor: number }[];
}
interface Booking { id: string; ref: string; kind: "hotel" | "flight"; status: string; offer_id: string | null; flight_offer_id: string | null; currency: string; total_minor: number; units: number; fee_minor: number; fee_currency: string }
interface Contact { provider_name: string; provider_phone: string | null; provider_address: string | null; provider_city: string | null }

/**
 * The campaign compares offers for its request, books, pays the confirmation deposit through Hamlaty, then sees the
 * provider's details. Campaigns never see a "Hamlaty fee": the amount is part of the provider's price (the provider
 * bears it, per the Hotel and Office Terms), so it is shown as the confirmation deposit deducted from what they owe.
 */
export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { me } = useMe("campaign");
  const [req, setReq] = useState<Req | null>(null);
  const [offers, setOffers] = useState<HotelOffer[]>([]);
  const [flightOffers, setFlightOffers] = useState<FlightOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [howToPay, setHowToPay] = useState<{ ar: string; en: string } | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("sent");
    if (n !== null) setSent(Number(n));
  }, []);

  const load = useCallback(async () => {
    const sb = supabase();
    const [r, o, f, b, s] = await Promise.all([
      sb.from("group_requests").select("id, ref, status, pilgrims, meal, respond_by, notes, stays:request_stays(*), flights:request_flights(*)").eq("id", id).maybeSingle(),
      sb.from("offers").select("*, lines:offer_lines(*)").eq("request_id", id),
      sb.from("flight_offers").select("*, lines:flight_offer_lines(*)").eq("request_id", id),
      sb.from("bookings").select("id, ref, kind, status, offer_id, flight_offer_id, currency, total_minor, units, fee_minor, fee_currency").eq("request_id", id).order("created_at"),
      sb.from("app_settings").select("value").eq("key", "fee_payment_instructions").maybeSingle(),
    ]);
    const err = r.error ?? o.error ?? f.error ?? b.error;
    if (err) return setError(friendlyError(err, lang));
    setReq(r.data as Req | null);
    setOffers((o.data as HotelOffer[]) ?? []);
    setFlightOffers((f.data as FlightOffer[]) ?? []);
    const list = (b.data as Booking[]) ?? [];
    setBookings(list);
    setHowToPay((s.data?.value as { ar: string; en: string }) ?? null);
    const shown: Record<string, Contact> = {};
    for (const x of list.filter((x) => x.status === "confirmed" || x.status === "completed")) {
      const { data } = await sb.rpc("booking_contacts", { p_booking: x.id });
      if (data?.[0]) shown[x.id] = data[0] as Contact;
    }
    setContacts(shown);
  }, [id, lang]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function book(kind: "hotel" | "flight", offerId: string) {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase().rpc(kind === "hotel" ? "accept_offer" : "accept_flight_offer", { p_offer: offerId });
    setBusy(false);
    setAsking(null);
    if (error) return setError(friendlyError(error, lang));
    if (data) await tell("booked", data as string);
    load();
  }

  async function cancel(b: Booking) {
    setBusy(true);
    setError(null);
    const { error } = await supabase().rpc("cancel_booking", { p_booking: b.id, p_reason: null });
    setBusy(false);
    setAsking(null);
    if (error) return setError(friendlyError(error, lang));
    await tell("cancelled", b.id);
    load();
  }

  async function closeRequest() {
    setBusy(true);
    const { error } = await supabase().from("group_requests").update({ status: "cancelled" }).eq("id", id);
    setBusy(false);
    setAsking(null);
    if (error) return setError(friendlyError(error, lang));
    load();
  }

  if (!req) return <Shell me={me}>{error ? <ErrorNote text={error} /> : <Loading />}</Shell>;

  const stays = [...req.stays].sort((a, b) => a.position - b.position);
  const flights = [...req.flights].sort((a, b) => a.position - b.position);
  const bookingFor = (offerId: string) => bookings.find((b) => (b.offer_id === offerId || b.flight_offer_id === offerId) && b.status !== "cancelled");
  const open = req.status === "open";
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  function HotelCard({ o, cheapest, nearest }: { o: HotelOffer; cheapest: boolean; nearest: boolean }) {
    const b = bookingFor(o.id);
    return (
      <li key={o.id} className="req-row">
        <div className="row spread">
          <b>
            {"★".repeat(o.snap_stars ?? 0)} · {t(`${distance(o.snap_distance_m, lang)} من الحرم`, `${distance(o.snap_distance_m, lang)} from the shrine`)}
          </b>
          <b className="num">{money(o.total_minor, o.currency, lang)}</b>
        </div>
        <div className="row small muted">
          {cheapest && <span className="chip good">{t("الأرخص", "Cheapest")}</span>}
          {nearest && <span className="chip info">{t("الأقرب", "Nearest")}</span>}
          {o.meal && <span>{mealName(o.meal, lang)}</span>}
          {o.snap_shrine && <span>{o.snap_shrine}</span>}
          {o.valid_until && <span>{t("صالح حتى ", "Valid until ")}{fmtDate(o.valid_until, lang)}</span>}
          {o.status !== "sent" && <span className="chip muted">{offerStatus(o.status, lang)}</span>}
        </div>
        <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
          {o.lines.map((l, i) => (
            <li key={i}>
              {t(`${l.rooms} غرفة ${roomName(l.room_type, lang)} × ${l.nights} ليالٍ × ${money(l.rate_minor, o.currency, lang)}`, `${l.rooms} ${roomName(l.room_type, lang)} × ${l.nights} nights × ${money(l.rate_minor, o.currency, lang)}`)}
            </li>
          ))}
        </ul>
        {o.notes && <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{o.notes}</p>}
        <div className="row">
          {o.status === "sent" && open && !b && (asking === o.id ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => book("hotel", o.id)}>{t("تأكيد الحجز", "Confirm booking")}</button>
              <button type="button" className="linkish" onClick={() => setAsking(null)}>{t("تراجع", "Back")}</button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setAsking(o.id)}>{t("احجز هذا العرض", "Book this offer")}</button>
          ))}
          <button type="button" className="btn ghost" onClick={() => setChat(chat === o.id ? null : o.id)}>{t("محادثة", "Chat")}</button>
        </div>
        {chat === o.id && me?.org && <Chat offerId={o.id} myOrgId={me.org.id} otherLabel={t("الفندق", "the hotel")} />}
      </li>
    );
  }

  function FlightCard({ o, cheapest }: { o: FlightOffer; cheapest: boolean }) {
    const b = bookingFor(o.id);
    return (
      <li key={o.id} className="req-row">
        <div className="row spread">
          <b>{[...new Set(o.lines.map((l) => l.airline))].join(" · ")}</b>
          <b className="num">{money(o.total_minor, o.currency, lang)}</b>
        </div>
        <div className="row small muted">
          {cheapest && <span className="chip good">{t("الأرخص", "Cheapest")}</span>}
          <span>{t(`مكتب من ${countryName(o.snap_country, lang)}`, `An office in ${countryName(o.snap_country, lang)}`)}</span>
          {o.valid_until && <span>{t("المقاعد محجوزة حتى ", "Seats held until ")}{fmtDateTime(o.valid_until, lang)}</span>}
          {o.status !== "sent" && <span className="chip muted">{offerStatus(o.status, lang)}</span>}
        </div>
        <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
          {o.lines.map((l, i) => (
            <li key={i}>
              <span className="num" dir="ltr">{l.flight_no ?? ""}</span> {l.depart_at && fmtDateTime(l.depart_at, lang)}
              {l.return_at && ` ⇄ ${fmtDateTime(l.return_at, lang)}`} · {t(`${l.seats} مقعداً × ${money(l.fare_minor, o.currency, lang)}`, `${l.seats} seats × ${money(l.fare_minor, o.currency, lang)}`)}
            </li>
          ))}
        </ul>
        {o.notes && <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{o.notes}</p>}
        <div className="row">
          {o.status === "sent" && open && !b && (asking === o.id ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => book("flight", o.id)}>{t("تأكيد الحجز", "Confirm booking")}</button>
              <button type="button" className="linkish" onClick={() => setAsking(null)}>{t("تراجع", "Back")}</button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setAsking(o.id)}>{t("احجز هذا العرض", "Book this offer")}</button>
          ))}
          <button type="button" className="btn ghost" onClick={() => setChat(chat === o.id ? null : o.id)}>{t("محادثة", "Chat")}</button>
        </div>
        {chat === o.id && me?.org && <Chat flightOfferId={o.id} myOrgId={me.org.id} otherLabel={t("المكتب", "the office")} />}
      </li>
    );
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">
          <Link href="/campaign">{t("طلباتي", "My requests")}</Link> · <span className="num">{req.ref}</span>
        </span>
        <h1>{requestStatus(req.status, lang)}</h1>
        <p>
          {t(`${req.pilgrims} زائراً · ${mealName(req.meal, lang)} · الرد قبل ${fmtDateTime(req.respond_by, lang)}`, `${req.pilgrims} pilgrims · ${mealName(req.meal, lang)} · offers by ${fmtDateTime(req.respond_by, lang)}`)}
        </p>
      </div>
      {sent !== null && (
        <div className={`notice ${sent > 0 ? "good" : ""}`}>
          {sent > 0
            ? t(`أُرسل طلبك إلى ${sent} من الفنادق والمكاتب الموثّقة. ستصلك رسالة عند وصول كل عرض.`, `Your request went to ${sent} verified hotels and offices. You'll get a text as each offer arrives.`)
            : t("لا توجد حالياً فنادق أو مكاتب موثّقة تطابق طلبك. سيصل الطلب إلى من يُوثَّق منها لاحقاً.", "No verified hotels or offices match your request yet. It will reach those verified later.")}
        </div>
      )}
      <ErrorNote text={error} />

      {bookings.filter((b) => b.status !== "cancelled").length > 0 && (
        <section className="panel">
          <h2>{t("حجوزاتي", "My bookings")}</h2>
          <ul className="list">
            {bookings.filter((b) => b.status !== "cancelled").map((b) => {
              const c = contacts[b.id];
              const phone = intlPhone(c?.provider_phone);
              return (
                <li key={b.id} className="req-row">
                  <div className="row spread">
                    <b>
                      <span className="num">{b.ref}</span> · {b.kind === "hotel" ? t("فندق", "Hotel") : t("طيران", "Flight")}
                    </b>
                    <span className={`chip ${b.status === "confirmed" || b.status === "completed" ? "good" : "warn"}`}>{bookingStatus(b.status, lang)}</span>
                  </div>
                  <div className="row small muted">
                    <span>{t("قيمة الحجز ", "Booking value ")}{money(b.total_minor, b.currency, lang)}</span>
                    <span>
                      {t("عربون التأكيد عبر حملتي ", "Confirmation deposit via Hamlaty ")}
                      {money(b.fee_minor, b.fee_currency, lang)}
                    </span>
                  </div>
                  {b.status === "pending_hotel" && (
                    <p className="small muted" style={{ margin: 0 }}>{t("بانتظار تأكيد الفندق أو المكتب. سنرسل لك رسالة.", "Waiting for the hotel or office to confirm. We'll text you.")}</p>
                  )}
                  {b.status === "awaiting_payment" && (
                    <div className="notice">
                      <b>{t(`ادفع عربون التأكيد ${money(b.fee_minor, b.fee_currency, lang)} لتأكيد الحجز`, `Pay the confirmation deposit of ${money(b.fee_minor, b.fee_currency, lang)} to confirm`)}</b>
                      <span className="small">{howToPay ? L(howToPay.ar, howToPay.en) : ""}</span>
                      <span className="small">
                        {b.kind === "hotel"
                          ? t("يُخصم هذا المبلغ من المستحق للفندق، فلا تدفع أي مبلغ إضافي. ادفع الباقي للفندق مباشرة بعد التأكيد.", "This amount is deducted from what you owe the hotel, so you pay nothing extra. Pay the rest to the hotel directly after confirmation.")
                          : t("يُخصم هذا المبلغ من المستحق للمكتب، فلا تدفع أي مبلغ إضافي. ادفع الباقي للمكتب مباشرة بعد التأكيد.", "This amount is deducted from what you owe the office, so you pay nothing extra. Pay the rest to the office directly after confirmation.")}
                      </span>
                    </div>
                  )}
                  {c && (
                    <div className="notice good">
                      <b>{c.provider_name}</b>
                      {c.provider_city && <span className="small">{c.provider_city}{c.provider_address ? ` · ${c.provider_address}` : ""}</span>}
                      {phone && (
                        <span className="row small">
                          <a href={`tel:+${phone}`} className="num" dir="ltr">+{phone}</a>
                          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">{t("واتساب", "WhatsApp")}</a>
                        </span>
                      )}
                    </div>
                  )}
                  {(b.status === "pending_hotel" || b.status === "awaiting_payment" || b.status === "confirmed") && (
                    <div className="row">
                      {asking === b.id ? (
                        <>
                          <button type="button" className="btn danger" disabled={busy} onClick={() => cancel(b)}>{t("تأكيد الإلغاء", "Confirm cancellation")}</button>
                          <button type="button" className="linkish" onClick={() => setAsking(null)}>{t("تراجع", "Back")}</button>
                        </>
                      ) : (
                        <button type="button" className="linkish" onClick={() => setAsking(b.id)}>{t("إلغاء الحجز", "Cancel booking")}</button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {stays.map((s) => {
        const list = offers.filter((o) => o.lines.some((l) => l.stay_id === s.id)).sort((a, b) => a.total_minor - b.total_minor);
        const live = list.filter((o) => o.status === "sent");
        const nearest = live.length ? Math.min(...live.map((o) => o.snap_distance_m ?? 1e9)) : null;
        return (
          <section key={s.id} className="panel">
            <h2>{t(`فنادق ${cityName(s.city, lang)}`, `Hotels in ${cityName(s.city, lang)}`)}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {fmtDate(s.check_in, lang)} · {t(`${s.nights} ليالٍ`, `${s.nights} nights`)} ·{" "}
              {(["single", "double", "triple", "quad"] as const)
                .filter((r) => s[`rooms_${r}`] > 0)
                .map((r) => `${s[`rooms_${r}`]} ${roomName(r, lang)}`)
                .join("، ")}
            </p>
            {!list.length ? (
              <p className="small muted">{t("لم تصل عروض بعد.", "No offers yet.")}</p>
            ) : (
              <ul className="list">
                {/* Called as functions, not as <Components>, so an open chat keeps its typed text when the page refreshes. */}
                {list.map((o) => HotelCard({ o, cheapest: o.status === "sent" && o.id === live[0]?.id, nearest: o.status === "sent" && live.length > 1 && o.snap_distance_m === nearest }))}
              </ul>
            )}
          </section>
        );
      })}

      {flights.map((f) => {
        const list = flightOffers.filter((o) => o.lines.some((l) => l.flight_id === f.id)).sort((a, b) => a.total_minor - b.total_minor);
        const live = list.filter((o) => o.status === "sent");
        return (
          <section key={f.id} className="panel">
            <h2 dir="auto">
              {t("طيران ", "Flight ")}
              {airportName(f.from_airport, lang)} → {airportName(f.to_airport, lang)}
            </h2>
            <p className="small muted" style={{ margin: 0 }}>
              {fmtDate(f.depart_on, lang)}
              {f.return_on && ` ⇄ ${fmtDate(f.return_on, lang)}`} · {t(`${f.seats} مقعداً`, `${f.seats} seats`)}
              {f.baggage_kg ? t(` · ${f.baggage_kg} كغ`, ` · ${f.baggage_kg} kg`) : ""}
            </p>
            {!list.length ? (
              <p className="small muted">{t("لم تصل عروض بعد.", "No offers yet.")}</p>
            ) : (
              <ul className="list">
                {list.map((o) => FlightCard({ o, cheapest: o.status === "sent" && o.id === live[0]?.id }))}
              </ul>
            )}
          </section>
        );
      })}

      {req.notes && (
        <section className="panel">
          <h2>{t("ملاحظاتك", "Your notes")}</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{req.notes}</p>
        </section>
      )}

      {open && !bookings.some((b) => b.status !== "cancelled") && (
        <div className="row">
          {asking === "close" ? (
            <>
              <button type="button" className="btn danger" disabled={busy} onClick={closeRequest}>{t("تأكيد إلغاء الطلب", "Confirm cancelling the request")}</button>
              <button type="button" className="linkish" onClick={() => setAsking(null)}>{t("تراجع", "Back")}</button>
            </>
          ) : (
            <button type="button" className="linkish" onClick={() => setAsking("close")}>{t("إلغاء الطلب", "Cancel the request")}</button>
          )}
        </div>
      )}
    </Shell>
  );
}
