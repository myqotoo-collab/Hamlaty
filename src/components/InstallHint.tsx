"use client";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

const DISMISSED = "hamlaty-install-hint";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * For signed-in people: suggest adding Hamlaty to the home screen, once.
 * On iPhone this matters most: Safari signs people out of sites they have not opened for 7 days, but not a
 * home-screen app. On Android/Chrome the browser's own install prompt is offered.
 */
export function InstallHint() {
  const { t } = useLang();
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      return;
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // Only Safari on iPhone can add to the home screen; Chrome/Firefox there say "open in Safari".
    if (ios) return setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {}
    setMode(null);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    dismiss();
  }

  if (!mode) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const iosOtherBrowser = mode === "ios" && /CriOS|FxiOS|EdgiOS/.test(ua);

  return (
    <div className="install-hint" role="note">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} />
      <div className="stack" style={{ gap: 4 }}>
        <b>{t("أضف حملتي إلى الشاشة الرئيسية", "Add Hamlaty to your home screen")}</b>
        {mode === "ios" ? (
          <span className="small">
            {iosOtherBrowser
              ? t("افتح hamlaty.co في Safari، ثم اضغط زر المشاركة ⬆️ واختر «إضافة إلى الشاشة الرئيسية». تبقى مسجّل الدخول دون رمز جديد.", "Open hamlaty.co in Safari, tap Share ⬆️ and choose “Add to Home Screen”. You stay signed in without a new code.")
              : t("اضغط زر المشاركة ⬆️ أسفل الشاشة، ثم «إضافة إلى الشاشة الرئيسية». يفتح حملتي كتطبيق وتبقى مسجّل الدخول دون رمز جديد.", "Tap Share ⬆️ at the bottom, then “Add to Home Screen”. Hamlaty opens like an app and you stay signed in without a new code.")}
          </span>
        ) : (
          <span className="small">{t("يفتح كتطبيق بضغطة واحدة، وتبقى مسجّل الدخول.", "Opens like an app in one tap, and you stay signed in.")}</span>
        )}
        <div className="row">
          {mode === "android" && (
            <button type="button" className="btn" onClick={install}>
              {t("إضافة", "Add")}
            </button>
          )}
          <button type="button" className="linkish small" onClick={dismiss}>
            {mode === "ios" ? t("حسناً", "Got it") : t("ليس الآن", "Not now")}
          </button>
        </div>
      </div>
    </div>
  );
}
