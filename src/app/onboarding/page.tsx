"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ErrorNote } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { takeNext, useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { CAMPAIGN_COUNTRIES, HOLY_CITIES, cityName, type OrgKind } from "@/lib/types";

export default function Onboarding() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { me } = useMe("no-org");
  // No default: signing up as the wrong kind is easy to miss, so the choice is always explicit.
  const [kind, setKind] = useState<OrgKind | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("OM");
  const [city, setCity] = useState<string>(HOLY_CITIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const as = sessionStorage.getItem("hamlaty-as");
      if (as === "campaign" || as === "hotel") setKind(as);
    } catch {}
  }, []);

  useEffect(() => {
    // The country of the sign-in number is the likely country of the campaign.
    const dial = me?.phone?.replace(/\D/g, "") ?? "";
    const guess: Record<string, string> = { "968": "OM", "965": "KW", "973": "BH", "966": "SA", "971": "AE", "974": "QA", "961": "LB", "964": "IQ" };
    const hit = Object.keys(guess).find((d) => dial.startsWith(d));
    if (hit) setCountry(guess[hit]);
  }, [me?.phone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!kind) return setError(t("اختر: هل أنت حملة أم فندق؟", "Choose: are you a campaign or a hotel?"));
    if (name.trim().length < 2) return setError(kind === "hotel" ? t("اكتب اسم الفندق.", "Enter the hotel name.") : t("اكتب اسم الحملة.", "Enter the campaign name."));
    setBusy(true);
    const { error } = await supabase().rpc("create_my_organization", {
      p_kind: kind,
      p_name: name.trim(),
      p_country: kind === "campaign" ? country : null,
      p_city: kind === "hotel" ? city : null,
    });
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    router.replace(kind === "hotel" ? "/hotel/profile" : (takeNext() ?? "/campaign"));
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{t("خطوة أخيرة", "Last step")}</span>
        <h1>{t("عرّفنا بك", "Tell us who you are")}</h1>
      </div>
      <form className="panel" onSubmit={submit}>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 6 }}>
            {t("أنت", "You are")}
          </legend>
          <div className="kind-pick">
            <label className={`kind-card ${kind === "campaign" ? "on" : ""}`}>
              <input type="radio" name="kind" checked={kind === "campaign"} onChange={() => setKind("campaign")} />
              <b>{t("حملة زيارة", "Ziyarat campaign")}</b>
              <span>{t("أنظّم رحلات الزوار إلى العراق، وأطلب عروض الفنادق", "I organise pilgrim trips to Iraq and request hotel offers")}</span>
            </label>
            <label className={`kind-card ${kind === "hotel" ? "on" : ""}`}>
              <input type="radio" name="kind" checked={kind === "hotel"} onChange={() => setKind("hotel")} />
              <b>{t("فندق", "Hotel")}</b>
              <span>{t("فندق في كربلاء أو النجف أو الكاظمية أو سامراء، أرسل عروضاً للحملات", "A hotel in Karbala, Najaf, Kadhimiya or Samarra sending offers to campaigns")}</span>
            </label>
          </div>
        </fieldset>
        <label className="field" htmlFor="name">
          {kind === "hotel" ? t("اسم الفندق", "Hotel name") : t("اسم الحملة", "Campaign name")}
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "hotel" ? t("مثال: فندق الروضة", "e.g. Al-Rawda Hotel") : t("مثال: حملة النور", "e.g. Al-Noor Campaign")} />
        </label>
        {kind === "hotel" ? (
          <label className="field" htmlFor="city">
            {t("المدينة", "City")}
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {HOLY_CITIES.map((c) => (
                <option key={c} value={c}>
                  {cityName(c, lang)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field" htmlFor="country">
            {t("دولة الحملة", "Campaign country")}
            <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
              {Object.entries(CAMPAIGN_COUNTRIES).map(([code, [ar, en]]) => (
                <option key={code} value={code}>
                  {lang === "en" ? en : ar}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "hotel" && (
          <p className="small muted">
            {t(
              "يراجع فريق حملتي الفندق وصوره ومسافته إلى الحرم، ثم تبدأ طلبات الحملات بالوصول إليك. التسجيل مجاني.",
              "The Hamlaty team checks the hotel, its photos and its distance to the shrine, then campaign requests start reaching you. Joining is free.",
            )}
          </p>
        )}
        <ErrorNote text={error} />
        <button className="btn" disabled={busy}>
          {busy ? t("جارٍ الحفظ…", "Saving…") : kind === "hotel" ? t("متابعة كفندق", "Continue as a hotel") : kind === "campaign" ? t("متابعة كحملة", "Continue as a campaign") : t("متابعة", "Continue")}
        </button>
      </form>
    </Shell>
  );
}
