"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { countryName, offerStatus } from "@/lib/types";

interface Row {
  id: string;
  status: string;
  request: {
    ref: string;
    pilgrims: number;
    from_country: string | null;
    respond_by: string;
    flights: { from_airport: string; to_airport: string; depart_on: string; return_on: string | null; seats: number; position: number }[];
  } | null;
}

/** A flight booking office: the campaigns' flight requests routed to it. */
export default function AgencyHome() {
  const { t, lang } = useLang();
  const { me } = useMe("agency");
  const [profile, setProfile] = useState<{ verified: boolean } | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.org) return;
    const sb = supabase();
    sb.from("agency_profiles")
      .select("verified")
      .eq("org_id", me.org.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
    sb.from("flight_offers")
      .select("id, status, request:group_requests(ref, pilgrims, from_country, respond_by, flights:request_flights(from_airport, to_airport, depart_on, return_on, seats, position))")
      .eq("agency_id", me.org.id)
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
        <h1>{t("طلبات الطيران", "Flight requests")}</h1>
        <p>{t("طلبات تذاكر مجموعات من حملات الزيارة. أرسل عرضك قبل انتهاء المهلة.", "Group ticket requests from ziyarat campaigns. Send your offer before the deadline.")}</p>
      </div>

      {profile === null && (
        <div className="notice">
          <b>{t("أكمل ملف المكتب", "Complete your office profile")}</b>
          <span className="small">{t("رقم الترخيص والدول التي تخدمها. بدونها لا تصلك الطلبات.", "Your licence number and the countries you serve. Without them no requests reach you.")}</span>
          <Link href="/agency/profile" className="btn" style={{ justifySelf: "start" }}>
            {t("أكمل الملف", "Complete the profile")}
          </Link>
        </div>
      )}
      {profile && (pending || !profile.verified) && (
        <div className="notice">
          <b>{t("حسابك قيد المراجعة", "Your account is being reviewed")}</b>
          <span className="small">
            {t("يتحقق فريق حملتي من ترخيص المكتب. سنرسل لك رسالة عند التفعيل، ثم تبدأ الطلبات بالوصول.", "The Hamlaty team is checking your licence. We'll text you once it's active, then requests start arriving.")}
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
            const flights = [...r.flights].sort((a, b) => a.position - b.position);
            return (
              <li key={o.id} className="req-row">
                <div className="row spread">
                  <b className="num">{r.ref}</b>
                  <span className={`chip ${o.status === "draft" ? "warn" : o.status === "accepted" ? "good" : "muted"}`}>{offerStatus(o.status, lang)}</span>
                </div>
                <div className="row small muted">
                  <span>{t(`حملة من ${countryName(r.from_country, lang)}`, `A campaign from ${countryName(r.from_country, lang)}`)}</span>
                  {flights.map((f) => (
                    <span key={f.position} className="num" dir="ltr">
                      {f.from_airport} → {f.to_airport} · {fmtDate(f.depart_on, lang)}
                      {f.return_on ? ` ⇄ ${fmtDate(f.return_on, lang)}` : ""} · {t(`${f.seats} مقعداً`, `${f.seats} seats`)}
                    </span>
                  ))}
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
