"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { normalize } from "@/lib/text";
import { useLang } from "@/lib/i18n";
import { CONTACT, LEGAL_DOCS } from "@/lib/legalDocs";
import { useOptionalMe } from "@/lib/useMe";

function TermsIcon() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      <defs>
        <linearGradient id="lgDoc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9ECF5" />
          <stop offset="1" stopColor="#B9C1D6" />
        </linearGradient>
        <linearGradient id="lgGavel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A9D8F" />
          <stop offset="1" stopColor="#1B1F3B" />
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="52" rx="24" ry="3" fill="#15201E" opacity="0.12" />
      <rect x="8" y="4" width="34" height="44" rx="4" fill="url(#lgDoc)" />
      <path d="M14 14h22M14 21h22M14 28h14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-40 46 34)">
        <rect x="34" y="26" width="22" height="11" rx="3" fill="url(#lgGavel)" />
        <rect x="43" y="37" width="4" height="16" rx="2" fill="#1B1F3B" />
      </g>
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      <defs>
        <linearGradient id="lgShield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D6EFEB" />
          <stop offset="1" stopColor="#9ED8CF" />
        </linearGradient>
        <linearGradient id="lgHead" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A9D8F" />
          <stop offset="1" stopColor="#1B1F3B" />
        </linearGradient>
      </defs>
      <ellipse cx="30" cy="52" rx="22" ry="3" fill="#15201E" opacity="0.12" />
      <path d="M30 3 L52 11 V27 C52 40 42 47 30 51 C18 47 8 40 8 27 V11 Z" fill="url(#lgShield)" />
      <circle cx="30" cy="22" r="7" fill="url(#lgHead)" />
      <path d="M17 41 C19 33 24 31 30 31 C36 31 41 33 43 41 C39 45 35 47 30 48 C25 47 21 45 17 41 Z" fill="#1B1F3B" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      <defs>
        <radialGradient id="lgGlobe" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#5FC4B6" />
          <stop offset="1" stopColor="#1B1F3B" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="52" rx="20" ry="3" fill="#15201E" opacity="0.12" />
      <circle cx="32" cy="26" r="21" fill="url(#lgGlobe)" />
      <path d="M11 26h42M32 5c-7 6-9 14-9 21s2 15 9 21M32 5c7 6 9 14 9 21s-2 15-9 21" stroke="#FFFFFF" strokeWidth="1.8" fill="none" opacity="0.7" />
      <path d="M20 16c4 1 6 4 5 7s-5 2-6 6c-1 3 1 6 1 6" stroke="#C9A24A" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const GROUPS = [
  { id: "terms" as const, ar: "الشروط القانونية", en: "Legal terms", subAr: "الشروط التي توافق عليها عند استخدام حملتي", subEn: "Terms you agree to when you use Hamlaty", Icon: TermsIcon },
  { id: "countries" as const, ar: "الدول", en: "Countries", subAr: "دول الحملات والعراق: القوانين والعملة والتأشيرات", subEn: "Campaign countries and Iraq: laws, currency and visas", Icon: GlobeIcon },
  { id: "privacy" as const, ar: "سياسة الخصوصية", en: "Privacy policy", subAr: "كيف نتعامل مع بياناتك الشخصية", subEn: "How we handle your personal information", Icon: PrivacyIcon },
];

export default function LegalHub() {
  const { t, lang } = useLang();
  const me = useOptionalMe();
  const [q, setQ] = useState("");

  // Search titles, summaries and the full text of each document.
  const docs = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return LEGAL_DOCS;
    return LEGAL_DOCS.filter((d) =>
      normalize(
        [d.titleAr, d.titleEn, d.summaryAr, d.summaryEn, ...d.clauses.flatMap((c) => [c.hAr, c.hEn, ...c.ar, ...c.en])].join(" "),
      ).includes(nq),
    );
  }, [q]);

  return (
    <Shell me={me} isPublic className="home-page">
      <section className="legal-hero">
        <p>{t("مرحباً بك في", "Welcome to")}</p>
        <h1>{t("مركز حملتي القانوني", "Hamlaty Legal Hub")}</h1>
        <p className="muted">{t("كل الشروط والسياسات التي تنظم استخدام حملتي بين حملات الزيارة والفنادق، في مكان واحد.", "All the terms and policies for using Hamlaty between ziyarat campaigns and hotels, in one place.")}</p>
        <label className="legal-search" htmlFor="legal-q">
          <span className="sr-only">{t("ابحث في الوثائق", "Search the documents")}</span>
          <input id="legal-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث: إلغاء، عمولة، بيانات…", "Search: cancellation, commission, data…")} />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </label>
      </section>

      {GROUPS.map((g) => {
        const list = docs.filter((d) => d.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="legal-group">
            <g.Icon />
            <h2>{t(g.ar, g.en)}</h2>
            <p className="muted">{t(g.subAr, g.subEn)}</p>
            <ul>
              {list.map((d) => (
                <li key={d.slug}>
                  <Link href={`/legal/${d.slug}`}>{lang === "en" ? d.titleEn : d.titleAr}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!docs.length && <p className="muted">{t("لا توجد نتائج مطابقة.", "No matches.")}</p>}

      <section className="legal-contact">
        <h2>{t("الشفافية أولاً", "Transparency first")}</h2>
        <p>
          {t(
            "بنينا هذا المركز لتصل إلى كل ما يخصك قانونياً بسهولة، وليكون التعامل بين الحملات والفنادق واضحاً للجميع.",
            "We built this hub so you can find everything that concerns you legally, and so dealings between campaigns and hotels are clear for everyone.",
          )}
        </p>
        <h2>{t("تحتاج التواصل معنا؟", "Need to contact us?")}</h2>
        <p>
          {t("لأي سؤال عن استخدام الخدمة: ", "For any question about using the service: ")}
          <a href={`mailto:${CONTACT.support}`}>{CONTACT.support}</a>
        </p>
        <p>
          {t("لأي سؤال عن خصوصيتك أو بياناتك الشخصية: ", "For any question about your privacy or personal data: ")}
          <a href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</a>
        </p>
      </section>
    </Shell>
  );
}
