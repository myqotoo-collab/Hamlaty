"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";
const KEY = "hamlaty-lang";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "ar", setLang: () => {} });

/** Holds the visitor's language, remembers it, and flips <html lang/dir>. Arabic is the default. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

/** `t("عربي", "English")` picks the text for the current language. */
export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  return { lang, setLang, t };
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button type="button" className="lang-toggle" onClick={() => setLang(lang === "ar" ? "en" : "ar")} lang={lang === "ar" ? "en" : "ar"}>
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
