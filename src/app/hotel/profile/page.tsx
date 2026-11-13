"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ErrorNote, Loading } from "@/components/Shell";
import { friendlyError, supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { HOLY_CITIES, MEAL_PLANS, SHRINES, cityName, mealName, type HotelProfile, type MealPlan } from "@/lib/types";

type Form = Omit<HotelProfile, "org_id" | "verified">;

export default function HotelProfilePage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { me } = useMe("hotel");
  const [form, setForm] = useState<Form | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [verified, setVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!me?.org) return;
    setPhone(me.org.phone ?? "");
    supabase()
      .from("hotel_profiles")
      .select("*")
      .eq("org_id", me.org.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error, lang));
        const city = data?.city ?? me.org?.city ?? HOLY_CITIES[0];
        setIsNew(!data);
        setVerified(!!data?.verified);
        setForm({
          city,
          stars: data?.stars ?? 3,
          distance_to_shrine_m: data?.distance_to_shrine_m ?? 0,
          shrine: data?.shrine ?? SHRINES[city]?.[0] ?? null,
          rooms_total: data?.rooms_total ?? null,
          meals: data?.meals ?? ["breakfast"],
          address: data?.address ?? null,
          about: data?.about ?? null,
        });
      });
  }, [me?.org, lang]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggleMeal = (m: MealPlan) => form && set("meals", form.meals.includes(m) ? form.meals.filter((x) => x !== m) : [...form.meals, m]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !me?.org) return;
    setError(null);
    setSaved(false);
    if (!form.meals.length) return setError(t("اختر الوجبات التي تقدمها.", "Choose the meals you offer."));
    setBusy(true);
    const sb = supabase();
    const { error } = await sb.from("hotel_profiles").upsert({ org_id: me.org.id, ...form });
    // The phone stays private: campaigns see it only after the hotel confirms a booking.
    const r2 = error ? null : await sb.from("organizations").update({ phone: phone.trim() || null }).eq("id", me.org.id);
    setBusy(false);
    const err = error ?? r2?.error;
    if (err) return setError(friendlyError(err, lang));
    setSaved(true);
    if (isNew) router.replace("/hotel");
  }

  return (
    <Shell me={me}>
      <div className="head">
        <span className="eyebrow">{me?.org?.name}</span>
        <h1>{t("ملف الفندق", "Hotel profile")}</h1>
        <p>
          {t(
            "هذه البيانات هي ما يراه مدير الحملة في عرضك، دون اسم الفندق أو رقمه حتى يتم الحجز.",
            "This is what a campaign manager sees in your offer, without your hotel's name or number until they book.",
          )}
        </p>
      </div>
      {!form ? (
        <Loading />
      ) : (
        <form className="panel" onSubmit={save}>
          {verified && (
            <p className="small muted">
              {t("تغيير المدينة أو النجوم أو المسافة يعيد الفندق للمراجعة.", "Changing the city, stars or distance sends the hotel back for review.")}
            </p>
          )}
          <div className="grid2">
            <label className="field" htmlFor="city">
              {t("المدينة", "City")}
              <select
                id="city"
                value={form.city}
                onChange={(e) => {
                  set("city", e.target.value);
                  set("shrine", SHRINES[e.target.value]?.[0] ?? null);
                }}
              >
                {HOLY_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {cityName(c, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="stars">
              {t("النجوم", "Stars")}
              <select id="stars" value={form.stars} onChange={(e) => set("stars", Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="dist">
              {t("المسافة إلى الحرم (متر)", "Distance to the shrine (meters)")}
              <input id="dist" className="num" inputMode="numeric" value={form.distance_to_shrine_m} onChange={(e) => set("distance_to_shrine_m", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </label>
            <label className="field" htmlFor="rooms">
              {t("عدد الغرف", "Number of rooms")}
              <input id="rooms" className="num" inputMode="numeric" value={form.rooms_total ?? ""} onChange={(e) => set("rooms_total", Number(e.target.value.replace(/\D/g, "")) || null)} />
            </label>
          </div>
          <label className="field" htmlFor="shrine">
            {t("المسافة محسوبة إلى", "Distance measured to")}
            <input id="shrine" value={form.shrine ?? ""} onChange={(e) => set("shrine", e.target.value || null)} />
          </label>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ marginBottom: 4 }}>
              {t("الوجبات التي تقدمها", "Meals you offer")}
            </legend>
            <div className="row">
              {MEAL_PLANS.map((m) => (
                <label key={m} className="check">
                  <input type="checkbox" checked={form.meals.includes(m)} onChange={() => toggleMeal(m)} />
                  {mealName(m, lang)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field" htmlFor="address">
            {t("العنوان", "Address")}
            <input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value || null)} placeholder={t("يظهر للحملة بعد تأكيد الحجز فقط", "Shown to the campaign only after you confirm a booking")} />
          </label>
          <label className="field" htmlFor="phone">
            {t("رقم الحجوزات (مع رمز الدولة)", "Bookings phone (with country code)")}
            <input id="phone" className="num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+964 7XX XXX XXXX" />
          </label>
          <label className="field" htmlFor="about">
            {t("نبذة عن الفندق", "About the hotel")}
            <textarea id="about" rows={3} value={form.about ?? ""} onChange={(e) => set("about", e.target.value || null)} placeholder={t("المصعد، المطعم، قربه من الأسواق… (أرقام الهواتف والروابط تُخفى تلقائياً)", "Lift, restaurant, nearby markets… (phone numbers and links are hidden automatically)")} />
          </label>
          <ErrorNote text={error} />
          {saved && <p className="ok-note">{t("تم الحفظ.", "Saved.")}</p>}
          <button className="btn" disabled={busy}>
            {busy ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
          </button>
        </form>
      )}
    </Shell>
  );
}
