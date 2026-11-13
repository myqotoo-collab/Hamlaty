// SMS notifications through Twilio (server only).
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_MESSAGING_SERVICE_SID (MG…) or TWILIO_FROM
// (a sender name such as "Hamlaty", or a Twilio number like +1…). Without them nothing is sent.
// Each (business, kind, key) is texted at most once; every attempt is recorded in `notifications`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHONE_COUNTRIES } from "./format";

export type NotifyKind = "new_request" | "offer_sent" | "offer_accepted" | "booking_confirmed" | "booking_cancelled" | "message";

// With https:// every phone shows it as a link you can tap.
const SITE = "https://hamlaty.co";

/** "+…" from a stored number that already carries its country code ("964770…", "00968…", "+973 3…"); null otherwise. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  for (const c of PHONE_COUNTRIES) if (d.startsWith(c.dial) && c.pattern.test(d.slice(c.dial.length))) return "+" + d;
  return null;
}

export function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM));
}

async function sendSms(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // Values pasted into Vercel sometimes carry a space or line break.
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      ...(process.env.TWILIO_MESSAGING_SERVICE_SID ? { MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID.trim() } : { From: process.env.TWILIO_FROM!.trim() }),
      Body: body,
    }),
  });
  if (res.ok) return { ok: true };
  const j = (await res.json().catch(() => ({}))) as { message?: string; code?: number };
  return { ok: false, error: `${res.status} ${j.code ?? ""} ${j.message ?? ""}`.trim().slice(0, 300) };
}

/** The phone to text for a business: its own phone, else its owner's sign-in number. */
async function phoneFor(admin: SupabaseClient, orgId: string): Promise<{ phone: string | null; on: boolean }> {
  const { data: org } = await admin.from("organizations").select("phone, sms_notifications").eq("id", orgId).maybeSingle();
  if (!org) return { phone: null, on: false };
  const on = org.sms_notifications !== false;
  let phone = toE164(org.phone);
  if (!phone) {
    const { data: owners } = await admin.from("memberships").select("user_id, role").eq("org_id", orgId);
    const ids = (owners ?? []).sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner")).map((m) => m.user_id);
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("user_id, phone").in("user_id", ids);
      for (const id of ids) {
        phone = toE164(profs?.find((p) => p.user_id === id)?.phone);
        if (phone) break;
      }
    }
  }
  return { phone, on };
}

export const texts = {
  new_request: (ref: string, pilgrims: number, offerId: string) =>
    `حملتي: طلب مجموعة جديد ${ref} (${pilgrims} زائراً). أرسل عرضك: ${SITE}/hotel/offers/${offerId}`,
  offer_sent: (ref: string, requestId: string) => `حملتي: وصلك عرض فندق جديد على طلبك ${ref}. قارن العروض: ${SITE}/campaign/requests/${requestId}`,
  offer_accepted: (ref: string, bookingId: string) => `حملتي: تم اختيار عرضك على الطلب ${ref}. أكّد الحجز: ${SITE}/hotel/bookings/${bookingId}`,
  booking_confirmed: (ref: string, bookingId: string) => `حملتي: أكّد الفندق حجزك ${ref}. التفاصيل: ${SITE}/campaign/bookings/${bookingId}`,
};

/**
 * Text one business about an event, once. Never throws: a failed SMS must not break the action that caused it.
 */
export async function notify(admin: SupabaseClient, orgId: string, kind: NotifyKind, key: string, body: string): Promise<string> {
  try {
    if (!smsConfigured()) return "not_configured";
    let { data: row, error } = await admin.from("notifications").insert({ org_id: orgId, kind, key }).select("id").maybeSingle();
    if (error?.code === "23505") {
      // Already recorded: send again only if the last attempt failed.
      const { data: prev } = await admin.from("notifications").select("id, status").eq("org_id", orgId).eq("kind", kind).eq("key", key).maybeSingle();
      if (prev?.status !== "failed") return "duplicate";
      row = { id: prev.id };
      error = null;
    }
    if (error || !row) return "no_table";
    const { phone, on } = await phoneFor(admin, orgId);
    if (!on || !phone) {
      await admin.from("notifications").update({ status: "skipped", detail: on ? "no mobile number" : "switched off" }).eq("id", row.id);
      return "skipped";
    }
    const r = await sendSms(phone, body);
    await admin
      .from("notifications")
      .update({ to_phone: phone.slice(0, -4).replace(/\d/g, "•") + phone.slice(-4), status: r.ok ? "sent" : "failed", detail: r.ok ? null : r.error })
      .eq("id", row.id);
    return r.ok ? "sent" : "failed";
  } catch (e) {
    console.error("notify failed", kind, e);
    return "error";
  }
}
