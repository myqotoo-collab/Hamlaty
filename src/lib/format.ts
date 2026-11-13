import type { Lang } from "./i18n";

/** Decimal places per currency. Amounts are stored in minor units: cents for USD, whole dinars for IQD. */
export const CURRENCY_DECIMALS: Record<string, number> = { USD: 2, IQD: 0 };

/** An amount in minor units, for display: "$1,250.00" / "1,500,000 د.ع". */
export function money(minor: number | null | undefined, currency = "USD", lang: Lang = "ar"): string {
  if (minor === null || minor === undefined) return "—";
  const dp = CURRENCY_DECIMALS[currency] ?? 2;
  const n = (minor / 10 ** dp).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  if (currency === "USD") return lang === "ar" ? `${n} $` : `$${n}`;
  if (currency === "IQD") return lang === "ar" ? `${n} د.ع` : `IQD ${n}`;
  return `${currency} ${n}`;
}

export const fmtDate = (iso: string | null | undefined, lang: Lang = "ar") =>
  iso ? new Date(iso).toLocaleDateString(lang === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * Countries people sign in from, with their mobile-number rules: the Gulf and Lebanon (campaigns),
 * and Iraq (hotels).
 */
export const PHONE_COUNTRIES = [
  { code: "OM", dial: "968", ar: "عُمان", en: "Oman", pattern: /^[79]\d{7}$/, example: "9XXXXXXX", hintAr: "8 أرقام تبدأ بـ 7 أو 9", hintEn: "8 digits starting with 7 or 9" },
  { code: "IQ", dial: "964", ar: "العراق", en: "Iraq", pattern: /^7\d{9}$/, example: "7XXXXXXXXX", hintAr: "10 أرقام تبدأ بـ 7", hintEn: "10 digits starting with 7" },
  { code: "KW", dial: "965", ar: "الكويت", en: "Kuwait", pattern: /^[569]\d{7}$/, example: "5XXXXXXX", hintAr: "8 أرقام تبدأ بـ 5 أو 6 أو 9", hintEn: "8 digits starting with 5, 6 or 9" },
  { code: "BH", dial: "973", ar: "البحرين", en: "Bahrain", pattern: /^[36]\d{7}$/, example: "3XXXXXXX", hintAr: "8 أرقام تبدأ بـ 3 أو 6", hintEn: "8 digits starting with 3 or 6" },
  { code: "SA", dial: "966", ar: "السعودية", en: "Saudi Arabia", pattern: /^5\d{8}$/, example: "5XXXXXXXX", hintAr: "9 أرقام تبدأ بـ 5", hintEn: "9 digits starting with 5" },
  { code: "AE", dial: "971", ar: "الإمارات", en: "UAE", pattern: /^5\d{8}$/, example: "5XXXXXXXX", hintAr: "9 أرقام تبدأ بـ 5", hintEn: "9 digits starting with 5" },
  { code: "QA", dial: "974", ar: "قطر", en: "Qatar", pattern: /^[3567]\d{7}$/, example: "3XXXXXXX", hintAr: "8 أرقام تبدأ بـ 3 أو 5 أو 6 أو 7", hintEn: "8 digits starting with 3, 5, 6 or 7" },
  { code: "LB", dial: "961", ar: "لبنان", en: "Lebanon", pattern: /^(3\d{6}|7[016789]\d{6}|81\d{6})$/, example: "3XXXXXX", hintAr: "7 أو 8 أرقام تبدأ بـ 3 أو 7 أو 81", hintEn: "7 or 8 digits starting with 3, 7 or 81" },
] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["code"];

const toAsciiDigits = (s: string) => s.replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)));

/** A mobile number in the chosen country → E.164 without "+", as Supabase stores it. Accepts Arabic digits, a leading 0 and the country code. */
export function normalizePhone(input: string, country: PhoneCountry): string | null {
  const c = PHONE_COUNTRIES.find((x) => x.code === country)!;
  let d = toAsciiDigits(input).replace(/\D/g, "");
  if (d.startsWith("00" + c.dial)) d = d.slice(2 + c.dial.length);
  else if (d.startsWith(c.dial) && !c.pattern.test(d)) d = d.slice(c.dial.length);
  if (d.startsWith("0") && !c.pattern.test(d)) d = d.slice(1);
  return c.pattern.test(d) ? c.dial + d : null;
}

/** International digits for a stored phone with its country code ("+964 770…", "00968…"), for tel: and wa.me links. */
export function intlPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = toAsciiDigits(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  for (const c of PHONE_COUNTRIES) if (d.startsWith(c.dial) && c.pattern.test(d.slice(c.dial.length))) return d;
  return null;
}

/** Meters to a short distance: "150 م" / "1.2 كم". */
export function distance(m: number | null | undefined, lang: Lang = "ar"): string {
  if (m === null || m === undefined) return "—";
  if (m < 1000) return lang === "ar" ? `${m} م` : `${m} m`;
  const km = (m / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return lang === "ar" ? `${km} كم` : `${km} km`;
}
