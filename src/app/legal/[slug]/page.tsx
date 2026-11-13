"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useLang } from "@/lib/i18n";
import { CONTACT, docBySlug, LEGAL_UPDATED } from "@/lib/legalDocs";
import { fmtDate } from "@/lib/format";
import { useOptionalMe } from "@/lib/useMe";

export default function LegalDocPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLang();
  const me = useOptionalMe();
  const doc = docBySlug(slug);
  const en = lang === "en";

  if (!doc)
    return (
      <Shell me={me} isPublic className="home-page">
        <p>{t("هذه الوثيقة غير موجودة.", "This document does not exist.")}</p>
        <Link href="/legal">{t("العودة إلى المركز القانوني", "Back to the Legal Hub")}</Link>
      </Shell>
    );

  return (
    <Shell me={me} isPublic className="home-page">
      <article className="legal-doc">
        <Link href="/legal" className="small">
          {t("← المركز القانوني", "← Legal Hub")}
        </Link>
        <h1>{en ? doc.titleEn : doc.titleAr}</h1>
        <p className="small muted">
          {t("آخر تحديث: ", "Last updated: ")}
          {fmtDate(LEGAL_UPDATED, lang)}
          {en && " · The Arabic text is the reference version."}
        </p>
        {doc.clauses.map((c) => (
          <section key={c.hAr}>
            <h2>{en ? c.hEn : c.hAr}</h2>
            {(en ? c.en : c.ar).length > 1 ? (
              <ul>
                {(en ? c.en : c.ar).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p>{(en ? c.en : c.ar)[0]}</p>
            )}
          </section>
        ))}
        <p className="small muted">
          {doc.group === "privacy" ? t("للتواصل بشأن الخصوصية: ", "Privacy contact: ") : t("للتواصل: ", "Contact: ")}
          <a href={`mailto:${doc.group === "privacy" ? CONTACT.privacy : CONTACT.support}`}>{doc.group === "privacy" ? CONTACT.privacy : CONTACT.support}</a>
        </p>
      </article>
    </Shell>
  );
}
