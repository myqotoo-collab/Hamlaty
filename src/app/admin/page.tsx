"use client";
import { useCallback, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { AdminMfaGate } from "@/components/AdminMfaGate";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { distance, fmtDate, money } from "@/lib/format";
import { cityName, countryName, type AgencyProfile, type HotelProfile, type Org } from "@/lib/types";

type Row = Org & { created_at: string; hotel: HotelProfile | null; agency: AgencyProfile | null };
interface FeeRow {
  id: string;
  ref: string;
  kind: "hotel" | "flight";
  units: number;
  fee_minor: number;
  fee_currency: string;
  campaign_id: string;
  hotel_id: string | null;
  agency_id: string | null;
  created_at: string;
}

/** Hamlaty team: check hotels and flight offices, switch businesses on or off, and record fees received. */
export default function Admin() {
  const { t, lang } = useLang();
  const { me } = useMe("admin");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<{ requests: number; offers: number; bookings: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [orgs, hotels, agencies, due, req, off, book] = await Promise.all([
      sb.from("organizations").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("hotel_profiles").select("*"),
      sb.from("agency_profiles").select("*"),
      sb.from("bookings").select("id, ref, kind, units, fee_minor, fee_currency, campaign_id, hotel_id, agency_id, created_at").eq("status", "awaiting_payment").order("created_at"),
      sb.from("group_requests").select("id", { count: "exact", head: true }),
      sb.from("offers").select("id", { count: "exact", head: true }).neq("status", "draft"),
      sb.from("bookings").select("id", { count: "exact", head: true }),
    ]);
    const err = orgs.error ?? hotels.error ?? agencies.error ?? due.error;
    if (err) return setError(friendlyError(err, lang));
    const byHotel = new Map((hotels.data as HotelProfile[]).map((h) => [h.org_id, h]));
    const byAgency = new Map((agencies.data as AgencyProfile[]).map((a) => [a.org_id, a]));
    setRows((orgs.data as (Org & { created_at: string })[]).map((o) => ({ ...o, hotel: byHotel.get(o.id) ?? null, agency: byAgency.get(o.id) ?? null })));
    setFees((due.data as FeeRow[]) ?? []);
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
  const verify = (o: Row) =>
    act(o.id, () => supabase().from(o.kind === "agency" ? "agency_profiles" : "hotel_profiles").update({ verified: true }).eq("org_id", o.id));
  const feePaid = (f: FeeRow) => act(f.id, () => supabase().rpc("mark_fee_paid", { p_booking: f.id, p_reference: refs[f.id] ?? null }));

  const name = (id: string | null) => rows?.find((r) => r.id === id)?.name ?? "—";
  const providers = rows?.filter((r) => r.kind === "hotel" || r.kind === "agency") ?? [];
  const toCheck = providers.filter((p) => p.status === "pending" || (p.hotel && !p.hotel.verified) || (p.agency && !p.agency.verified));
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
                <div className="k">{t("عروض فنادق مرسلة", "Hotel offers sent")}</div>
              </div>
              <div className="stat">
                <div className="v">{stats.bookings}</div>
                <div className="k">{t("حجوزات", "Bookings")}</div>
              </div>
            </div>

            <section className="panel">
              <h2>{t(`رسوم بانتظار الدفع (${fees.length})`, `Fees awaiting payment (${fees.length})`)}</h2>
              <p className="small muted">
                {t(
                  "بعد استلام الرسوم من الحملة، اكتب رقم التحويل واضغط «تم الاستلام». يتأكد الحجز فوراً ويرى الطرفان بيانات بعضهما.",
                  "Once the campaign's fee arrives, enter the transfer reference and tap “Received”. The booking is confirmed at once and both sides see each other's details.",
                )}
              </p>
              {!fees.length && <p className="small muted">{t("لا يوجد.", "None.")}</p>}
              <ul className="list">
                {fees.map((f) => (
                  <li key={f.id} className="req-row">
                    <div className="row spread">
                      <b className="num">{f.ref}</b>
                      <b className="num">{money(f.fee_minor, f.fee_currency, lang)}</b>
                    </div>
                    <div className="row small muted">
                      <span>{name(f.campaign_id)}</span>
                      <span>→ {name(f.hotel_id ?? f.agency_id)}</span>
                      <span>{f.kind === "hotel" ? t(`${f.units} زائراً × 1$`, `${f.units} pilgrims × $1`) : t(`${f.units} تذكرة × 3$`, `${f.units} tickets × $3`)}</span>
                      <span>{fmtDate(f.created_at, lang)}</span>
                    </div>
                    <div className="row">
                      <input
                        aria-label={t("رقم التحويل", "Transfer reference")}
                        placeholder={t("رقم التحويل", "Transfer reference")}
                        value={refs[f.id] ?? ""}
                        onChange={(e) => setRefs((r) => ({ ...r, [f.id]: e.target.value }))}
                        style={{ flex: "1 1 160px" }}
                      />
                      <button type="button" className="btn teal" disabled={busy === f.id} onClick={() => feePaid(f)}>
                        {t("تم الاستلام", "Received")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>{t(`بانتظار المراجعة (${toCheck.length})`, `To check (${toCheck.length})`)}</h2>
              {!toCheck.length && <p className="small muted">{t("لا يوجد.", "None.")}</p>}
              <ul className="list">
                {toCheck.map((o) => (
                  <li key={o.id} className="req-row">
                    <div className="row spread">
                      <b>
                        {o.name} <span className="chip muted">{o.kind === "agency" ? t("مكتب طيران", "Flight office") : t("فندق", "Hotel")}</span>
                      </b>
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
                    ) : o.agency ? (
                      <div className="row small muted">
                        <span>{countryName(o.country, lang)}</span>
                        <span className="num">{t("الترخيص: ", "Licence: ")}{o.agency.license_no ?? "—"}</span>
                        <span>{o.agency.countries.length ? o.agency.countries.map((c) => countryName(c, lang)).join("، ") : t("كل الدول", "All countries")}</span>
                        {o.agency.airlines && <span>{o.agency.airlines}</span>}
                        {o.phone && <span className="num">{o.phone}</span>}
                      </div>
                    ) : (
                      <span className="small muted">{t("لم يُكمل الملف بعد.", "Profile not completed yet.")}</span>
                    )}
                    <div className="row">
                      {o.status !== "active" && (
                        <button type="button" className="btn" disabled={busy === o.id} onClick={() => setStatus(o, "active")}>
                          {t("تفعيل الحساب", "Activate account")}
                        </button>
                      )}
                      {((o.hotel && !o.hotel.verified) || (o.agency && !o.agency.verified)) && (
                        <button type="button" className="btn teal" disabled={busy === o.id} onClick={() => verify(o)}>
                          {t("توثيق", "Verify")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>{t(`الفنادق ومكاتب الطيران (${providers.length})`, `Hotels and flight offices (${providers.length})`)}</h2>
              <ul className="list">
                {providers.map((o) => (
                  <li key={o.id} className="row spread small">
                    <span>
                      <b>{o.name}</b> · {o.kind === "agency" ? t("مكتب طيران", "Flight office") : o.hotel ? cityName(o.hotel.city, lang) : "—"}{" "}
                      {(o.hotel?.verified || o.agency?.verified) && <span className="chip good">{t("موثّق", "Verified")}</span>}
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
