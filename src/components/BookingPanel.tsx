"use client";
import { useEffect, useState } from "react";
import { friendlyError, supabase, tell } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { intlPhone, money } from "@/lib/format";
import { bookingStatus, countryName } from "@/lib/types";
import { ErrorNote } from "@/components/Shell";

export interface ProviderBooking {
  id: string;
  ref: string;
  status: string;
  currency: string;
  total_minor: number;
  units: number;
  fee_minor: number;
  fee_currency: string;
}

interface Contact {
  campaign_name: string;
  campaign_phone: string | null;
  campaign_country: string | null;
}

/** The hotel's or office's side of a booking: confirm or decline, wait for the fee, then see the campaign. */
export function BookingPanel({ booking, onChange }: { booking: ProviderBooking; onChange: () => void }) {
  const { t, lang } = useLang();
  const [contact, setContact] = useState<Contact | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booking.status !== "confirmed" && booking.status !== "completed") return setContact(null);
    supabase()
      .rpc("booking_contacts", { p_booking: booking.id })
      .then(({ data }) => setContact((data?.[0] as Contact) ?? null));
  }, [booking.id, booking.status]);

  async function run(fn: "confirm_booking" | "cancel_booking" | "complete_booking", event?: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase().rpc(fn, fn === "cancel_booking" ? { p_booking: booking.id, p_reason: null } : { p_booking: booking.id });
    setBusy(false);
    setAsking(false);
    if (error) return setError(friendlyError(error, lang));
    if (event) await tell(event, booking.id);
    onChange();
  }

  const phone = intlPhone(contact?.campaign_phone);

  return (
    <section className="panel" style={{ borderColor: "var(--teal)" }}>
      <div className="row spread">
        <h2>
          {t("حجز ", "Booking ")}
          <span className="num">{booking.ref}</span>
        </h2>
        <span className={`chip ${booking.status === "confirmed" || booking.status === "completed" ? "good" : "warn"}`}>{bookingStatus(booking.status, lang)}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t("قيمة الحجز ", "Booking value ")}
        {money(booking.total_minor, booking.currency, lang)} · {t("رسوم حملتي ", "Hamlaty fee ")}
        {money(booking.fee_minor, booking.fee_currency, lang)} {t("(من العربون)", "(from the deposit)")}
      </p>

      {booking.status === "pending_hotel" && (
        <>
          <p style={{ margin: 0 }}>{t("اختارت الحملة عرضك. أكّد أن الغرف أو المقاعد متاحة ومحجوزة لها.", "The campaign chose your offer. Confirm the rooms or seats are available and held for them.")}</p>
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => run("confirm_booking", "provider_confirmed")}>{t("أؤكد الحجز", "Confirm booking")}</button>
            {asking ? (
              <>
                <button type="button" className="btn danger" disabled={busy} onClick={() => run("cancel_booking", "cancelled")}>{t("تأكيد الاعتذار", "Confirm declining")}</button>
                <button type="button" className="linkish" onClick={() => setAsking(false)}>{t("تراجع", "Back")}</button>
              </>
            ) : (
              <button type="button" className="linkish" onClick={() => setAsking(true)}>{t("اعتذار", "Decline")}</button>
            )}
          </div>
        </>
      )}
      {booking.status === "awaiting_payment" && (
        <p className="small" style={{ margin: 0 }}>
          {t("بانتظار دفع الحملة رسوم حملتي. عند الدفع يتأكد الحجز وتظهر لك بيانات الحملة، وستصلك رسالة.", "Waiting for the campaign to pay the Hamlaty fee. Once paid, the booking is confirmed, you'll see the campaign's details, and we'll text you.")}
        </p>
      )}
      {contact && (
        <div className="notice good">
          <b>{contact.campaign_name}</b>
          <span className="small">{countryName(contact.campaign_country, lang)}</span>
          {phone && (
            <span className="row small">
              <a href={`tel:+${phone}`} className="num" dir="ltr">+{phone}</a>
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">{t("واتساب", "WhatsApp")}</a>
            </span>
          )}
        </div>
      )}
      {booking.status === "confirmed" && (
        <button type="button" className="btn ghost" disabled={busy} onClick={() => run("complete_booking")} style={{ justifySelf: "start" }}>
          {t("انتهت الإقامة أو الرحلة", "Stay or trip completed")}
        </button>
      )}
      <ErrorNote text={error} />
    </section>
  );
}
