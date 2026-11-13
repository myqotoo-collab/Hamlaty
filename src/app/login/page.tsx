"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEGAL_UPDATED } from "@/lib/legalDocs";
import { friendlyError, supabase } from "@/lib/supabase";
import { normalizePhone, PHONE_COUNTRIES, type PhoneCountry } from "@/lib/format";
import { ErrorNote } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { LangToggle, useLang } from "@/lib/i18n";

export default function Login() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<PhoneCountry>("OM");
  const pc = PHONE_COUNTRIES.find((x) => x.code === country)!;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Data-protection laws need explicit consent before processing, including transfer to servers abroad.
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get("as");
    try {
      if (as === "campaign" || as === "hotel") sessionStorage.setItem("hamlaty-as", as);
    } catch {}
    // Hotels are in Iraq: start the country list there.
    if (as === "hotel") setCountry("IQ");
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/onboarding");
      });
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const e164 = normalizePhone(phone, country);
    if (!e164) return setError(t(`اكتب رقم جوال صحيحاً: ${pc.hintAr}.`, `Enter a valid mobile number: ${pc.hintEn}.`));
    if (!agreed) return setError(t("يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة.", "Please agree to the Terms and Privacy Policy to continue."));
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      phone: "+" + e164,
      // Recorded on the user for proof of consent.
      options: { data: { consent_terms_privacy: true, consent_transfer_abroad: true, consent_at: new Date().toISOString(), consent_version: LEGAL_UPDATED } },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    setSentTo(e164);
    setCooldown(60);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ phone: "+" + sentTo, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    router.replace("/onboarding");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="logo" aria-label={t("حملتي، الرئيسية", "Hamlaty home")}>
            <Logo />
          </Link>
          <nav className="nav">
            <LangToggle />
          </nav>
        </div>
      </header>
      <main className="wrap" style={{ maxWidth: 460 }}>
        <div className="head">
          <span className="eyebrow">{t("الدخول", "Sign in")}</span>
          <h1>{sentTo ? t("أدخل الرمز", "Enter the code") : t("ادخل برقم جوالك", "Sign in with your mobile")}</h1>
          <p>
            {sentTo
              ? t(`أرسلنا رمزاً من 6 أرقام إلى ‎+${sentTo}`, `We sent a 6-digit code to +${sentTo}`)
              : t("نرسل لك رمز دخول برسالة نصية. لا حاجة لكلمة مرور.", "We text you a sign-in code. No password needed.")}
          </p>
        </div>

        {!sentTo ? (
          <form className="panel" onSubmit={sendCode}>
            <label className="field" htmlFor="phone">
              {t("رقم الجوال", "Mobile number")}
              <div className="row" style={{ flexWrap: "nowrap", direction: "ltr" }}>
                <select aria-label={t("الدولة", "Country")} className="num" value={country} onChange={(e) => setCountry(e.target.value as PhoneCountry)} style={{ width: "auto", flex: "none" }}>
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      +{c.dial} {lang === "en" ? c.en : c.ar}
                    </option>
                  ))}
                </select>
                <input id="phone" className="num" inputMode="tel" autoComplete="tel-national" placeholder={pc.example} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </label>
            <label className="check" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 5 }} />
              <span>
                {t("أوافق على ", "I agree to the ")}
                <Link href="/legal/terms" target="_blank">{t("شروط الاستخدام", "Terms of Use")}</Link>
                {t(" و", " and ")}
                <Link href="/legal/privacy" target="_blank">{t("سياسة الخصوصية", "Privacy Policy")}</Link>
                {t("، وعلى معالجة بياناتي وحفظها لدى مزودي خدمات خارج دولتي.", ", and to my data being processed and stored by service providers outside my country.")}
              </span>
            </label>
            <ErrorNote text={error} />
            <button className="btn" disabled={busy}>
              {busy ? t("جارٍ الإرسال…", "Sending…") : t("أرسل الرمز", "Send code")}
            </button>
          </form>
        ) : (
          <form className="panel" onSubmit={verify}>
            <label className="field" htmlFor="code">
              {t("الرمز", "Code")}
              <input id="code" className="num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </label>
            <ErrorNote text={error} />
            <button className="btn" disabled={busy || code.length < 6}>
              {busy ? t("جارٍ التحقق…", "Checking…") : t("دخول", "Sign in")}
            </button>
            <div className="row spread small">
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setSentTo(null);
                  setCode("");
                }}
              >
                {t("تغيير الرقم", "Change number")}
              </button>
              <button type="button" className="linkish" disabled={cooldown > 0} onClick={() => sendCode()}>
                {cooldown > 0 ? t(`إعادة الإرسال بعد ${cooldown} ث`, `Resend in ${cooldown}s`) : t("إعادة إرسال الرمز", "Resend code")}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
