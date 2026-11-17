"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { CAMPAIGN_COUNTRIES, type AgencyProfile } from "@/lib/types";

type Form = Omit<AgencyProfile, "org_id" | "verified">;

export default function AgencyProfilePage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { me } = useMe("agency");
  const [form, setForm] = useState<Form | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [verified, setVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!me?.org) return;
    setPhone(me.org.phone ?? "");
    supabase()
      .from("agency_profiles")
      .select("*")
      .eq("org_id", me.org.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error, lang));
        setIsNew(!data);
        setVerified(!!data?.verified);
        setForm({
          license_no: data?.license_no ?? null,
          countries: data?.countries ?? (me.org?.country ? [me.org.country] : []),
          airlines: data?.airlines ?? null,
          about: data?.about ?? null,
        });
      });
  }, [me?.org, lang]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggleCountry = (c: string) => form && set("countries", form.countries.includes(c) ? form.countries.filter((x) => x !== c) : [...form.countries, c]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !me?.org) return;
    setError(null);
    setSaved(false);
    if (!form.license_no?.trim()) return setError(t("اكتب رقم ترخيص المكتب.", "Enter the office licence number."));
    setBusy(true);
    const sb = supabase();
    const { error } = await sb.from("agency_profiles").upsert({ org_id: me.org.id, ...form, license_no: form.license_no.trim() });
    // The phone stays private: campaigns see it only after the Hamlaty fee is paid.
    const r2 = error ? null : await sb.from("organizations").update({ phone: phone.trim() || null }).eq("id", me.org.id);
    setBusy(false);
    const err = error ?? r2?.error;
    if (err) return setError(friendlyError(err, lang));
    setSaved(true);
    if (isNew) router.replace("/agency");
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{me?.org?.name}</span>
        <h1>{t("ملف المكتب", "Office profile")}</h1>
        <p>
          {t(
            "يرى مدير الحملة في عرضك شركة الطيران والمواعيد والسعر، دون اسم مكتبك أو رقمه حتى يتم الحجز.",
            "A campaign manager sees the airline, times and price in your offer, without your office's name or number until they book.",
          )}
        </p>
      </div>
      {!form ? (
        <Loading />
      ) : (
        <form className="panel" onSubmit={save}>
          {verified && <p className="small muted">{t("تغيير رقم الترخيص يعيد المكتب للمراجعة.", "Changing the licence number sends the office back for review.")}</p>}
          <label className="field" htmlFor="license">
            {t("رقم الترخيص أو رقم IATA", "Licence or IATA number")}
            <input id="license" className="num" value={form.license_no ?? ""} onChange={(e) => set("license_no", e.target.value || null)} />
          </label>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ marginBottom: 4 }}>
              {t("حملات أي دول تخدم؟ (اترك الكل فارغاً لكل الدول)", "Campaigns from which countries do you serve? (leave all empty for every country)")}
            </legend>
            <div className="row">
              {Object.entries(CAMPAIGN_COUNTRIES).map(([code, [ar, en]]) => (
                <label key={code} className="check">
                  <input type="checkbox" checked={form.countries.includes(code)} onChange={() => toggleCountry(code)} />
                  {lang === "en" ? en : ar}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field" htmlFor="airlines">
            {t("شركات الطيران التي تحجز عليها", "Airlines you book")}
            <input id="airlines" value={form.airlines ?? ""} onChange={(e) => set("airlines", e.target.value || null)} placeholder={t("مثال: الطيران العماني، طيران السلام، الخطوط العراقية", "e.g. Oman Air, SalamAir, Iraqi Airways")} />
          </label>
          <label className="field" htmlFor="phone">
            {t("رقم الحجوزات (مع رمز الدولة)", "Bookings phone (with country code)")}
            <input id="phone" className="num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+968 9XXX XXXX" />
          </label>
          <label className="field" htmlFor="about">
            {t("نبذة عن المكتب", "About the office")}
            <textarea id="about" rows={3} value={form.about ?? ""} onChange={(e) => set("about", e.target.value || null)} placeholder={t("سنوات الخبرة، حجوزات المجموعات… (أرقام الهواتف والروابط تُخفى تلقائياً)", "Years of experience, group bookings… (phone numbers and links are hidden automatically)")} />
          </label>
          <ErrorNote text={error} />
          {saved && <p className="ok-note">{t("تم الحفظ.", "Saved.")}</p>}
          <button className="btn" disabled={busy}>
            {busy ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
          </button>
        </form>
      )}
    </Shell>
  );
}
