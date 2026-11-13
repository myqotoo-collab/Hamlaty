"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "./i18n";

let client: SupabaseClient | null = null;

/** Browser client. Uses the public (publishable/anon) key; Row Level Security protects the data. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase URL or key is missing. Set them in Vercel → Environment Variables.");
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
}

// Database messages (supabase/migrations) → a sentence people can act on.
const MESSAGES: [RegExp, string, string][] = [
  [/only price stays in your city/i, "يمكنك تسعير الإقامة في مدينة فندقك فقط.", "You can only price the stay in your hotel's city."],
  [/add at least one room price/i, "أضف سعر غرفة واحدة على الأقل قبل الإرسال.", "Add at least one room price before sending."],
  [/complete your hotel profile/i, "أكمل ملف الفندق أولاً.", "Complete your hotel profile first."],
  [/hotel account is not active/i, "حساب الفندق قيد المراجعة من فريق حملتي.", "Your hotel account is still being reviewed by Hamlaty."],
  [/time to answer this request has passed/i, "انتهت مهلة الرد على هذا الطلب.", "The time to answer this request has passed."],
  [/can no longer (be changed|be edited|get offers|be booked)/i, "لا يمكن تعديل هذا بعد الآن.", "This can no longer be changed."],
  [/city in this offer is already booked/i, "إحدى المدن في هذا العرض محجوزة مسبقاً.", "A city in this offer is already booked."],
  [/only a sent offer/i, "لا يمكن حجز هذا العرض الآن.", "This offer can't be booked right now."],
  [/offer has expired/i, "انتهت صلاحية هذا العرض.", "This offer has expired."],
  [/hotels already answered/i, "وصلت عروض على هذا الطلب. ألغِه وأرسل طلباً جديداً.", "Hotels already answered. Cancel it and send a new request."],
  [/only an active campaign/i, "حسابك غير مفعّل لإرسال الطلبات.", "Your account can't send requests right now."],
  [/registration link is not valid/i, "رابط التسجيل غير صالح أو انتهت الرحلة.", "This registration link is not valid or the trip has ended."],
  // Sending the code failed at the SMS provider: say so, and keep the provider's reason for support.
  [/Error sending .*(sms|otp)|sms.*provider|twilio/i, "تعذّر إرسال الرمز إلى هذا الرقم. تأكد من الرقم وحاول مرة أخرى.", "Could not send the code to this number. Check the number and try again."],
  [/Token has expired|token is invalid|invalid otp|otp (has )?expired/i, "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.", "The code is wrong or expired. Request a new one."],
  [/rate limit|too many/i, "محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.", "Too many attempts. Wait a minute and try again."],
  [/phone.*(provider|disabled)|Unsupported phone provider/i, "الدخول بالجوال غير مفعّل بعد في إعدادات Supabase.", "Phone sign-in isn’t enabled in Supabase yet."],
];

/** Turns a Supabase/Postgres error into a sentence the user can act on. */
export function friendlyError(err: unknown, lang: Lang = "ar"): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  for (const [re, ar, en] of MESSAGES)
    if (re.test(msg)) {
      const text = lang === "ar" ? ar : en;
      // Provider errors keep their original detail, so a screenshot tells what went wrong.
      return /Error sending|provider|twilio/i.test(msg) ? `${text} (${msg.slice(0, 160)})` : text;
    }
  return msg;
}

/** Authorization header for Hamlaty's own API routes, read from the live session at call time. */
export async function bearer(): Promise<Record<string, string>> {
  const sb = supabase();
  let { data } = await sb.auth.getSession();
  if (!data.session || (data.session.expires_at ?? 0) * 1000 < Date.now() + 60_000) ({ data } = await sb.auth.refreshSession());
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
