"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { AdminMfaGate } from "@/components/AdminMfaGate";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { HOLY_CITIES, PLACE_CATEGORY_KEYS, cityName, placeCategory } from "@/lib/types";
import type { Place } from "@/app/guide/page";

const EMPTY = { city: HOLY_CITIES[0] as string, category: "market", name_ar: "", name_en: "", about_ar: "", about_en: "", address: "", hours: "", map_url: "" };

/** Hamlaty team: add and hide entries in the pilgrims' guide. */
export default function AdminGuide() {
  const { t, lang } = useLang();
  const { me } = useMe("admin");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Admins see hidden entries too (places_admin policy).
    const { data, error } = await supabase().from("places").select("*").order("city").order("category").order("position");
    if (error) return setError(friendlyError(error, lang));
    setPlaces((data as Place[]) ?? []);
  }, [lang]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name_ar.trim().length < 2) return setError(t("اكتب الاسم بالعربية.", "Enter the Arabic name."));
    if (form.map_url && !form.map_url.startsWith("https://")) return setError(t("رابط الخريطة يجب أن يبدأ بـ https://", "The map link must start with https://"));
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase().from("places").insert(clean);
    setBusy(false);
    if (error) return setError(friendlyError(error, lang));
    setForm({ ...EMPTY, city: form.city, category: form.category });
    load();
  }

  async function toggle(p: Place) {
    const { error } = await supabase().from("places").update({ active: !p.active }).eq("id", p.id);
    if (error) return setError(friendlyError(error, lang));
    load();
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">
          <Link href="/admin">{t("الإدارة", "Admin")}</Link>
        </span>
        <h1>{t("دليل الزائر", "Pilgrim's guide")}</h1>
        <p>
          <Link href="/guide">{t("عرض الدليل كما يراه الزوار", "View the guide as pilgrims see it")}</Link>
        </p>
      </div>
      <AdminMfaGate onReady={load}>
        <form className="panel" onSubmit={add}>
          <h2>{t("إضافة مكان", "Add a place")}</h2>
          <div className="grid2">
            <label className="field">
              {t("المدينة", "City")}
              <select value={form.city} onChange={(e) => set("city", e.target.value)}>
                {HOLY_CITIES.map((c) => (
                  <option key={c} value={c}>{cityName(c, lang)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("النوع", "Type")}
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {PLACE_CATEGORY_KEYS.map((c) => (
                  <option key={c} value={c}>{placeCategory(c, lang)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("الاسم بالعربية", "Name (Arabic)")}
              <input value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
            </label>
            <label className="field">
              {t("الاسم بالإنجليزية", "Name (English)")}
              <input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
            </label>
            <label className="field">
              {t("أوقات العمل", "Opening hours")}
              <input value={form.hours} onChange={(e) => set("hours", e.target.value)} />
            </label>
            <label className="field">
              {t("العنوان", "Address")}
              <input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
          </div>
          <label className="field">
            {t("رابط الخريطة (Google Maps)", "Map link (Google Maps)")}
            <input className="num" dir="ltr" value={form.map_url} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          </label>
          <label className="field">
            {t("نبذة بالعربية", "About (Arabic)")}
            <textarea rows={3} value={form.about_ar} onChange={(e) => set("about_ar", e.target.value)} />
          </label>
          <label className="field">
            {t("نبذة بالإنجليزية", "About (English)")}
            <textarea rows={3} value={form.about_en} onChange={(e) => set("about_en", e.target.value)} />
          </label>
          <ErrorNote text={error} />
          <button className="btn" disabled={busy}>{t("إضافة", "Add")}</button>
        </form>

        <section className="panel">
          <h2>{t("الأماكن", "Places")}</h2>
          {!places ? (
            <Loading />
          ) : (
            <ul className="list">
              {places.map((p) => (
                <li key={p.id} className="row spread small">
                  <span style={{ opacity: p.active ? 1 : 0.5 }}>
                    <b>{p.name_ar}</b> · {cityName(p.city, lang)} · {placeCategory(p.category, lang)}
                  </span>
                  <button type="button" className="linkish" onClick={() => toggle(p)}>
                    {p.active ? t("إخفاء", "Hide") : t("إظهار", "Show")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminMfaGate>
    </Shell>
  );
}
