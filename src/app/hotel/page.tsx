"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { cityName, countryName, offerStatus } from "@/lib/types";

interface Row {
  id: string;
  status: string;
  request: {
    ref: string;
    pilgrims: number;
    from_country: string | null;
    respond_by: string;
    stays: { city: string; check_in: string; nights: number; position: number }[];
  } | null;
}

export default function HotelHome() {
  const { t, lang } = useLang();
  const { me } = useMe("hotel");
  const [profile, setProfile] = useState<{ verified: boolean } | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.org) return;
    const sb = supabase();
    sb.from("hotel_profiles")
      .select("verified")
      .eq("org_id", me.org.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
    sb.from("offers")
      .select("id, status, request:group_requests(ref, pilgrims, from_country, respond_by, stays:request_stays(city, check_in, nights, position))")
      .eq("hotel_id", me.org.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error, lang));
        setRows((data as unknown as Row[] | null) ?? []);
      });
  }, [me?.org, lang]);

  const pending = me?.org?.status === "pending";

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{me?.org?.name}</span>
        <h1>{t("الطلبات الواردة", "Incoming requests")}</h1>
        <p>{t("طلبات مجموعات من الحملات في مدينتك. أرسل عرضك قبل انتهاء المهلة.", "Group requests from campaigns in your city. Send your offer before the deadline.")}</p>
      </div>

      {profile === null && (
        <div className="notice">
          <b>{t("أكمل ملف الفندق", "Complete your hotel profile")}</b>
          <span className="small">{t("النجوم، والمسافة إلى الحرم، والوجبات. بدونها لا تصلك الطلبات.", "Stars, distance to the shrine and meals. Without them no requests reach you.")}</span>
          <Link href="/hotel/profile" className="btn" style={{ justifySelf: "start" }}>
            {t("أكمل الملف", "Complete the profile")}
          </Link>
        </div>
      )}
      {profile && (pending || !profile.verified) && (
        <div className="notice">
          <b>{t("حسابك قيد المراجعة", "Your account is being reviewed")}</b>
          <span className="small">
            {t(
              "يتحقق فريق حملتي من بيانات الفندق ومسافته إلى الحرم. سنرسل لك رسالة عند التفعيل، ثم تبدأ الطلبات بالوصول.",
              "The Hamlaty team is checking your hotel details and distance to the shrine. We'll text you once it's active, then requests start arriving.",
            )}
          </span>
        </div>
      )}

      <ErrorNote text={error} />
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">{t("لا توجد طلبات بعد.", "No requests yet.")}</p>
      ) : (
        <ul className="list">
          {rows.map((o) => {
            const r = o.request;
            if (!r) return null;
            const stays = [...r.stays].sort((a, b) => a.position - b.position);
            return (
              <li key={o.id} className="req-row">
                <div className="row spread">
                  <b className="num">{r.ref}</b>
                  <span className={`chip ${o.status === "draft" ? "warn" : o.status === "accepted" ? "good" : "muted"}`}>{offerStatus(o.status, lang)}</span>
                </div>
                <div className="row small muted">
                  <span>{t(`حملة من ${countryName(r.from_country, lang)}`, `A campaign from ${countryName(r.from_country, lang)}`)}</span>
                  <span>{t(`${r.pilgrims} زائراً`, `${r.pilgrims} pilgrims`)}</span>
                  <span>{stays.map((s) => `${cityName(s.city, lang)} ${fmtDate(s.check_in, lang)} (${s.nights})`).join(" · ")}</span>
                </div>
                {o.status === "draft" && (
                  <span className="small muted">
                    {t("الرد قبل: ", "Reply by: ")}
                    {fmtDate(r.respond_by, lang)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
