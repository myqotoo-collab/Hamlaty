"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { InstallHint } from "@/components/InstallHint";
import { supabase } from "@/lib/supabase";
import type { Me } from "@/lib/useMe";
import { LangToggle, useLang } from "@/lib/i18n";

type Icon = "home" | "list" | "hotel" | "shield" | "key";
interface NavLink {
  href: string;
  label: [string, string];
  short: [string, string];
  icon: Icon;
}

const NAV: Record<"campaign" | "hotel" | "guest", NavLink[]> = {
  campaign: [{ href: "/campaign", label: ["طلباتي", "My requests"], short: ["طلباتي", "Requests"], icon: "list" }],
  hotel: [
    { href: "/hotel", label: ["الطلبات الواردة", "Incoming requests"], short: ["الطلبات", "Requests"], icon: "list" },
    { href: "/hotel/profile", label: ["ملف الفندق", "Hotel profile"], short: ["الفندق", "Hotel"], icon: "hotel" },
  ],
  guest: [
    { href: "/", label: ["الرئيسية", "Home"], short: ["الرئيسية", "Home"], icon: "home" },
    { href: "/login", label: ["دخول", "Sign in"], short: ["دخول", "Sign in"], icon: "key" },
  ],
};

const PATHS: Record<Icon, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  hotel: "M5 20V7.5C5 5.5 8 3.5 12 3.5s7 2 7 4V20M3 20h18M10 20v-4h4v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01",
  shield: "M12 3.5 19.5 6v6c0 4.5-3.2 7.5-7.5 8.5C7.7 19.5 4.5 16.5 4.5 12V6Z",
  key: "M14.5 9.5a4 4 0 1 1-1.2-2.8M13.3 6.7 20 13.4l-2 2-1.5-1.5-1.5 1.5-1.5-1.5",
};

function Svg({ name }: { name: Icon }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * Page frame: top bar with full navigation on wide screens, a bottom tab bar on phones.
 * `isPublic` pages render for signed-out visitors too.
 */
export function Shell({ me, children, isPublic = false, className = "" }: { me: Me | null; children: ReactNode; isPublic?: boolean; className?: string }) {
  const path = usePathname();
  const router = useRouter();
  const { t, lang } = useLang();
  const L = (p: [string, string]) => (lang === "ar" ? p[0] : p[1]);
  const links = me?.org ? NAV[me.org.kind] : isPublic && !me ? NAV.guest : [];
  const tabs: NavLink[] = me?.isAdmin ? [...links, { href: "/admin", label: ["الإدارة", "Admin"], short: ["الإدارة", "Admin"], icon: "shield" }] : links;
  const active = (href: string) => (href === "/" ? path === "/" : path === href || (href !== "/hotel" && path.startsWith(href + "/")));
  const home = me?.org ? (me.org.kind === "hotel" ? "/hotel" : "/campaign") : "/";

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={`app ${className}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href={home} className="logo" aria-label={t("حملتي، الرئيسية", "Hamlaty home")}>
            <Logo />
          </Link>
          <nav className="nav" aria-label={t("القائمة", "Menu")}>
            {!me && (
              <Link href="/login?as=hotel" className="hpill">
                {t("سجّل فندقك", "List your hotel")}
              </Link>
            )}
            {tabs.map((l) => (
              <Link key={l.href} href={l.href} className="wide-only" aria-current={active(l.href) ? "page" : undefined}>
                {L(l.label)}
              </Link>
            ))}
            <LangToggle />
            {me && (
              <button type="button" className="linkish" onClick={signOut}>
                {t("خروج", "Sign out")}
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="wrap with-tabs">
        {me && <InstallHint />}
        {me || isPublic ? children : <p className="muted">{t("جارٍ التحميل…", "Loading…")}</p>}
        <SiteFooter />
      </main>
      {tabs.length > 0 && (
        <nav className="tabbar" aria-label={t("التنقل", "Navigation")}>
          {tabs.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>
              <Svg name={l.icon} />
              <span>{L(l.short)}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div>
        <h2>{t("حملتي", "Hamlaty")}</h2>
        <ul>
          <li><Link href="/login?as=campaign">{t("سجّل حملتك", "Register your campaign")}</Link></li>
          <li><Link href="/login?as=hotel">{t("سجّل فندقك", "List your hotel")}</Link></li>
          <li><Link href="/legal">{t("المركز القانوني", "Legal Hub")}</Link></li>
          <li><Link href="/legal/terms">{t("شروط الاستخدام", "Terms of Use")}</Link></li>
          <li><Link href="/legal/privacy">{t("سياسة الخصوصية", "Privacy Policy")}</Link></li>
        </ul>
      </div>
      <p className="small muted">© {new Date().getFullYear()} {t("حملتي", "Hamlaty")}</p>
    </footer>
  );
}

export function Loading() {
  const { t } = useLang();
  return <p className="muted">{t("جارٍ التحميل…", "Loading…")}</p>;
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="error" role="alert">
      {text}
    </p>
  );
}
