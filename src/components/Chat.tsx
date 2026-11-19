"use client";
import { useCallback, useEffect, useState } from "react";
import { friendlyError, supabase } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { ErrorNote } from "@/components/Shell";

interface Msg {
  id: number;
  sender_org: string;
  body: string;
  masked: boolean;
  created_at: string;
}

/**
 * Messages between a campaign and a hotel or office about one offer. Phone numbers, emails and links are
 * hidden by the database until the booking is confirmed (fee paid), so the chat cannot be used to go around Hamlaty.
 */
export function Chat({ offerId, flightOfferId, myOrgId, otherLabel }: { offerId?: string; flightOfferId?: string; myOrgId: string; otherLabel: string }) {
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const column = offerId ? "offer_id" : "flight_offer_id";
  const id = offerId ?? flightOfferId ?? "";

  const load = useCallback(async () => {
    const { data } = await supabase().from("messages").select("id, sender_org, body, masked, created_at").eq(column, id).order("id");
    setMsgs((data as Msg[] | null) ?? []);
  }, [column, id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("messages").insert({ [column]: id, sender_org: myOrgId, body: text.trim() });
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    setText("");
    load();
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <b className="small">{t(`محادثة مع ${otherLabel}`, `Chat with ${otherLabel}`)}</b>
      {msgs === null ? null : msgs.length === 0 ? (
        <p className="small muted">{t("لا توجد رسائل بعد.", "No messages yet.")}</p>
      ) : (
        <ul className="list" style={{ gap: 6 }}>
          {msgs.map((m) => (
            <li key={m.id} className="req-row" style={{ background: m.sender_org === myOrgId ? "var(--accent-soft)" : undefined, padding: "8px 12px" }}>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
              <span className="small muted">
                {m.sender_org === myOrgId ? t("أنت", "You") : otherLabel} · {fmtDateTime(m.created_at, lang)}
                {m.masked && t(" · أُخفيت بيانات التواصل", " · contact details hidden")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={send} style={{ flexWrap: "nowrap" }}>
        <input aria-label={t("اكتب رسالة", "Write a message")} placeholder={t("اكتب رسالة…", "Write a message…")} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <button className="btn" disabled={busy || !text.trim()}>
          {t("إرسال", "Send")}
        </button>
      </form>
      <p className="small muted">{t("أرقام الهواتف والروابط تُخفى حتى يتأكد الحجز.", "Phone numbers and links are hidden until the booking is confirmed.")}</p>
      <ErrorNote text={error} />
    </div>
  );
}
