"use client";
import { useEffect, useState, type ReactNode } from "react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

type State =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string; uri: string }
  | { kind: "error"; message: string }
  | { kind: "signin" };

/**
 * Admin pages open only after a code from an authenticator app (second check on top of the phone code).
 * The database enforces it too: is_admin() needs the session to have passed this check (migration 0016).
 */
export function AdminMfaGate({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const auth = supabase().auth;
      const mfa = auth.mfa;
      // Make sure the session is loaded (and refreshed if it just changed) before asking about the second check.
      let { data: sess } = await auth.getSession();
      if (!sess.session) ({ data: sess } = await auth.refreshSession());
      if (!sess.session) return setState({ kind: "signin" });
      const { data: aal, error: e1 } = await mfa.getAuthenticatorAssuranceLevel();
      if (e1) return setState(/session/i.test(e1.message) ? { kind: "signin" } : { kind: "error", message: friendlyError(e1, lang) });
      if (aal.currentLevel === "aal2") return setState({ kind: "ok" });
      const { data: factors, error: e2 } = await mfa.listFactors();
      if (e2) return setState(/session/i.test(e2.message) ? { kind: "signin" } : { kind: "error", message: friendlyError(e2, lang) });
      const verified = factors.totp.find((f) => f.status === "verified");
      if (verified) return setState({ kind: "verify", factorId: verified.id });
      // Remove a setup that was started but never finished, then start a fresh one.
      for (const f of factors.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) await mfa.unenroll({ factorId: f.id });
      const { data: en, error: e3 } = await mfa.enroll({ factorType: "totp", friendlyName: `Hamlaty ${new Date().toISOString().slice(0, 10)}`, issuer: "Hamlaty" });
      if (e3 && /session/i.test(e3.message)) return setState({ kind: "signin" });
      if (e3)
        return setState({
          kind: "error",
          // Supabase names the app entry after the account's email; an account with only a phone number has none.
          message: /QR/i.test(e3.message)
            ? t(
                "تعذّر إنشاء رمز التفعيل لأن حساب المدير ليس له بريد إلكتروني. أضف بريداً للحساب في Supabase ثم أعد فتح هذه الصفحة.",
                "Could not create the setup code because the admin account has no email. Add an email to the account in Supabase, then reopen this page.",
              )
            : friendlyError(e3, lang),
        });
      setState({ kind: "enroll", factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret, uri: en.totp.uri });
    })();
  }, [lang]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "verify" && state.kind !== "enroll") return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    if (error) {
      setBusy(false);
      setCode("");
      return setError(/invalid|expired/i.test(error.message) ? t("الرمز غير صحيح أو انتهت صلاحيته. أدخل الرمز الظاهر الآن في التطبيق.", "Wrong or expired code. Enter the code the app shows now.") : friendlyError(error, lang));
    }
    // The session now carries the second check; reload so every admin query uses it.
    window.location.reload();
  }

  useEffect(() => {
    if (state.kind === "ok") onReady?.();
  }, [state.kind, onReady]);

  if (state.kind === "ok") return <>{children}</>;
  if (state.kind === "loading") return <p className="small muted">{t("جارٍ التحقق…", "Checking…")}</p>;
  if (state.kind === "error") return <p className="error">{state.message}</p>;
  if (state.kind === "signin")
    return (
      <div className="panel">
        <p>{t("انتهت جلسة الدخول. سجّل الخروج ثم ادخل من جديد برقمك.", "Your sign-in session ended. Sign out, then sign in again with your number.")}</p>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await supabase().auth.signOut();
            window.location.href = "/login";
          }}
        >
          {t("خروج ثم دخول", "Sign out and sign in")}
        </button>
      </div>
    );

  const codeForm = (
    <form className="stack" onSubmit={submit} style={{ maxWidth: 320 }}>
      <label className="field" htmlFor="mfa-code">
        {t("الرمز من التطبيق (6 أرقام)", "Code from the app (6 digits)")}
        <input
          id="mfa-code"
          className="num"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          style={{ fontSize: 22, letterSpacing: 6, textAlign: "center" }}
          autoFocus
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy || code.length !== 6}>
        {busy ? t("جارٍ التحقق…", "Checking…") : t("تحقق وادخل", "Verify and continue")}
      </button>
    </form>
  );

  if (state.kind === "verify")
    return (
      <div className="panel">
        <h2>{t("التحقق الثاني للإدارة", "Admin second check")}</h2>
        <p className="small">{t("افتح تطبيق المصادقة على جوالك، وأدخل الرمز الظاهر بجانب Hamlaty.", "Open the authenticator app on your phone and enter the code shown next to Hamlaty.")}</p>
        {codeForm}
      </div>
    );

  return (
    <div className="panel">
      <h2>{t("فعّل التحقق الثاني للإدارة", "Set up the admin second check")}</h2>
      <p className="small">
        {t(
          "لحماية لوحة الإدارة، يلزم رمز من تطبيق مصادقة بالإضافة إلى رمز الجوال. تفعّله مرة واحدة فقط.",
          "To protect the admin panel, a code from an authenticator app is needed on top of the phone code. You set it up once.",
        )}
      </p>
      <ol className="mfa-steps">
        <li>
          {t("ثبّت تطبيق Google Authenticator أو Microsoft Authenticator على جوالك:", "Install Google Authenticator or Microsoft Authenticator on your phone:")}{" "}
          <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">
            iPhone
          </a>{" "}
          ·{" "}
          <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">
            Android
          </a>
        </li>
        <li>
          {t("أضف Hamlaty إلى التطبيق بإحدى الطرق:", "Add Hamlaty to the app in one of these ways:")}
          <ul>
            <li>
              {t("على نفس الجوال: ", "On this phone: ")}
              <a className="btn ghost small" href={state.uri}>
                {t("افتح في تطبيق المصادقة", "Open in the authenticator app")}
              </a>
            </li>
            <li>
              {t("من جهاز آخر: امسح الرمز بكاميرا التطبيق", "From another device: scan this with the app")}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.qr} alt={t("رمز QR للتطبيق", "QR code for the app")} width={180} height={180} style={{ display: "block", background: "#fff", padding: 8, borderRadius: 12, marginTop: 6 }} />
            </li>
            <li>
              {t("أو أدخل هذا المفتاح يدوياً:", "Or type this key by hand:")}{" "}
              <code className="num" style={{ wordBreak: "break-all" }}>
                {state.secret}
              </code>{" "}
              <button
                type="button"
                className="linkish small"
                onClick={() => navigator.clipboard?.writeText(state.secret).then(() => setCopied(true), () => {})}
              >
                {copied ? t("نُسخ", "Copied") : t("نسخ", "Copy")}
              </button>
            </li>
          </ul>
        </li>
        <li>{t("أدخل الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق:", "Enter the 6-digit code the app shows:")}</li>
      </ol>
      {codeForm}
      <p className="small muted">{t("لا تشارك هذا المفتاح أو صورة الرمز مع أحد.", "Do not share this key or the QR picture with anyone.")}</p>
    </div>
  );
}
