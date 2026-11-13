"use client";
import { useEffect, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { cityName, requestStatus } from "@/lib/types";

interface Row {
  id: string;
  ref: string;
  pilgrims: number;
  status: string;
  created_at: string;
  stays: { city: string; check_in: string; nights: number; position: number }[];
}

export default function CampaignHome() {
  const { t, lang } = useLang();
  const { me } = useMe("campaign");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.org) return;
    supabase()
      .from("group_requests")
      .select("id, ref, pilgrims, status, created_at, stays:request_stays(city, check_in, nights, position)")
      .eq("campaign_id", me.org.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error, lang));
        setRows((data as Row[] | null) ?? []);
      });
  }, [me?.org, lang]);

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{me?.org?.name}</span>
        <h1>{t("طلباتي", "My requests")}</h1>
        <p>{t("أرسل طلب مجموعة واحداً، وتصلك عروض الفنادق هنا لتقارن وتحجز.", "Send one group request and hotel offers arrive here to compare and book.")}</p>
      </div>

      <div className="panel">
        <div className="row spread">
          <div className="stack" style={{ gap: 2 }}>
            <b>{t("طلب مجموعة جديد", "New group request")}</b>
            <span className="small muted">{t("الزوار، المدن، الليالي، الغرف والوجبات.", "Pilgrims, cities, nights, rooms and meals.")}</span>
          </div>
          <span className="btn disabled" aria-disabled="true">
            {t("قريباً", "Coming soon")}
          </span>
        </div>
      </div>

      <ErrorNote text={error} />
      {rows === null ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">{t("لا توجد طلبات بعد.", "No requests yet.")}</p>
      ) : (
        <ul className="list">
          {rows.map((r) => {
            const stays = [...r.stays].sort((a, b) => a.position - b.position);
            return (
              <li key={r.id} className="req-row">
                <div className="row spread">
                  <b className="num">{r.ref}</b>
                  <span className={`chip ${r.status === "booked" ? "good" : r.status === "open" ? "info" : "muted"}`}>{requestStatus(r.status, lang)}</span>
                </div>
                <div className="row small muted">
                  <span>{t(`${r.pilgrims} زائراً`, `${r.pilgrims} pilgrims`)}</span>
                  <span>{stays.map((s) => `${cityName(s.city, lang)} (${s.nights})`).join(lang === "ar" ? " ← " : " → ")}</span>
                  {stays[0] && <span>{fmtDate(stays[0].check_in, lang)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
