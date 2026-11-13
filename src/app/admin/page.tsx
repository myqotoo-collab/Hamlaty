"use client";
import { useCallback, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { AdminMfaGate } from "@/components/AdminMfaGate";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { distance, fmtDate } from "@/lib/format";
import { cityName, countryName, type HotelProfile, type Org } from "@/lib/types";

type Row = Org & { created_at: string; hotel: HotelProfile | null };

/** Hamlaty team: check hotels (profile, distance) and switch businesses on or off. */
export default function Admin() {
  const { t, lang } = useLang();
  const { me } = useMe("admin");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<{ requests: number; offers: number; bookings: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [orgs, hotels, req, off, book] = await Promise.all([
      sb.from("organizations").select("*").order("created_at", { ascending: false }).limit(300),
      sb.from("hotel_profiles").select("*"),
      sb.from("group_requests").select("id", { count: "exact", head: true }),
      sb.from("offers").select("id", { count: "exact", head: true }).neq("status", "draft"),
      sb.from("bookings").select("id", { count: "exact", head: true }),
    ]);
    const err = orgs.error ?? hotels.error;
    if (err) return setError(friendlyError(err, lang));
    const byOrg = new Map((hotels.data as HotelProfile[]).map((h) => [h.org_id, h]));
    setRows((orgs.data as (Org & { created_at: string })[]).map((o) => ({ ...o, hotel: byOrg.get(o.id) ?? null })));
    setStats({ requests: req.count ?? 0, offers: off.count ?? 0, bookings: book.count ?? 0 });
  }, [lang]);

  async function act(id: string, change: () => PromiseLike<{ error: unknown }>) {
    setBusy(id);
    setError(null);
    const { error } = await change();
    setBusy(null);
    if (error) return setError(friendlyError(error, lang));
    await load();
  }
  const setStatus = (o: Row, status: Org["status"]) => act(o.id, () => supabase().from("organizations").update({ status }).eq("id", o.id));
  const verify = (o: Row, verified: boolean) => act(o.id, () => supabase().from("hotel_profiles").update({ verified }).eq("org_id", o.id));

  const hotels = rows?.filter((r) => r.kind === "hotel") ?? [];
  const toCheck = hotels.filter((h) => h.status === "pending" || (h.hotel && !h.hotel.verified));
  const campaigns = rows?.filter((r) => r.kind === "campaign") ?? [];

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{t("فريق حملتي", "Hamlaty team")}</span>
        <h1>{t("الإدارة", "Admin")}</h1>
      </div>
      <AdminMfaGate onReady={load}>
        <ErrorNote text={error} />
        {!rows || !stats ? (
          <Loading />
        ) : (
          <>
            <div className="stats">
              <div className="stat">
                <div className="v">{stats.requests}</div>
                <div className="k">{t("طلبات", "Requests")}</div>
              </div>
              <div className="stat">
                <div className="v">{stats.offers}</div>
                <div className="k">{t("عروض مرسلة", "Offers sent")}</div>
              </div>
              <div className="stat">
                <div className="v">{stats.bookings}</div>
                <div className="k">{t("حجوزات", "Bookings")}</div>
              </div>
            </div>

            <section className="panel">
              <h2>{t(`فنادق بانتظار المراجعة (${toCheck.length})`, `Hotels to check (${toCheck.length})`)}</h2>
              {!toCheck.length && <p className="small muted">{t("لا يوجد.", "None.")}</p>}
              <ul className="list">
                {toCheck.map((o) => (
                  <li key={o.id} className="req-row">
                    <div className="row spread">
                      <b>{o.name}</b>
                      <span className="small muted">{fmtDate(o.created_at, lang)}</span>
                    </div>
                    {o.hotel ? (
                      <div className="row small muted">
                        <span>{cityName(o.hotel.city, lang)}</span>
                        <span>{"★".repeat(o.hotel.stars)}</span>
                        <span>{t(`${distance(o.hotel.distance_to_shrine_m, lang)} من ${o.hotel.shrine ?? "الحرم"}`, `${distance(o.hotel.distance_to_shrine_m, lang)} from ${o.hotel.shrine ?? "the shrine"}`)}</span>
                        {o.phone && <span className="num">{o.phone}</span>}
                        {o.hotel.address && <span>{o.hotel.address}</span>}
                      </div>
                    ) : (
                      <span className="small muted">{t("لم يُكمل ملف الفندق بعد.", "Hotel profile not completed yet.")}</span>
                    )}
                    <div className="row">
                      {o.status !== "active" && (
                        <button type="button" className="btn" disabled={busy === o.id} onClick={() => setStatus(o, "active")}>
                          {t("تفعيل الحساب", "Activate account")}
                        </button>
                      )}
                      {o.hotel && !o.hotel.verified && (
                        <button type="button" className="btn teal" disabled={busy === o.id} onClick={() => verify(o, true)}>
                          {t("توثيق الفندق", "Verify hotel")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>{t(`كل الفنادق (${hotels.length})`, `All hotels (${hotels.length})`)}</h2>
              <ul className="list">
                {hotels.map((o) => (
                  <li key={o.id} className="row spread small">
                    <span>
                      <b>{o.name}</b> · {o.hotel ? cityName(o.hotel.city, lang) : "—"}{" "}
                      {o.hotel?.verified && <span className="chip good">{t("موثّق", "Verified")}</span>}
                    </span>
                    {o.status === "active" ? (
                      <button type="button" className="btn danger" disabled={busy === o.id} onClick={() => setStatus(o, "suspended")}>
                        {t("إيقاف", "Suspend")}
                      </button>
                    ) : (
                      <span className="chip muted">{o.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>{t(`الحملات (${campaigns.length})`, `Campaigns (${campaigns.length})`)}</h2>
              <ul className="list">
                {campaigns.map((o) => (
                  <li key={o.id} className="row spread small">
                    <span>
                      <b>{o.name}</b> · {countryName(o.country, lang)} · {fmtDate(o.created_at, lang)}
                    </span>
                    {o.status === "active" ? (
                      <button type="button" className="btn danger" disabled={busy === o.id} onClick={() => setStatus(o, "suspended")}>
                        {t("إيقاف", "Suspend")}
                      </button>
                    ) : (
                      <button type="button" className="btn" disabled={busy === o.id} onClick={() => setStatus(o, "active")}>
                        {t("تفعيل", "Activate")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </AdminMfaGate>
    </Shell>
  );
}
