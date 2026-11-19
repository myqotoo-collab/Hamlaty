"use client";
import { useEffect, useState } from "react";
import { Shell, Loading } from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useOptionalMe } from "@/lib/useMe";
import { useLang } from "@/lib/i18n";
import { HOLY_CITIES, PLACE_CATEGORY_KEYS, cityName, placeCategory } from "@/lib/types";

export interface Place {
  id: string;
  city: string;
  category: string;
  name_ar: string;
  name_en: string | null;
  about_ar: string | null;
  about_en: string | null;
  address: string | null;
  hours: string | null;
  map_url: string | null;
  featured: boolean;
  active: boolean;
  position: number;
}

/** The pilgrims' guide: shrines, ziyarat sites, markets, restaurants and programmes in each holy city. Open to everyone. */
export default function Guide() {
  const { t, lang } = useLang();
  const me = useOptionalMe();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [city, setCity] = useState<string>(HOLY_CITIES[0]);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("city");
    if (c && (HOLY_CITIES as readonly string[]).includes(c)) setCity(c);
    supabase()
      .from("places")
      .select("*")
      .order("featured", { ascending: false })
      .order("position")
      .then(({ data }) => setPlaces((data as Place[] | null) ?? []));
  }, []);

  const here = (places ?? []).filter((p) => p.city === city);
  const shown = here.filter((p) => !category || p.category === category);
  const categories = PLACE_CATEGORY_KEYS.filter((c) => here.some((p) => p.category === c));

  return (
    <Shell me={me} isPublic>
      <div className="head">
        <span className="eyebrow">{t("دليل الزائر", "Pilgrim's guide")}</span>
        <h1>{t(`${cityName(city, lang)}: المراقد والمواقع والأسواق والمطاعم`, `${cityName(city, lang)}: shrines, sites, markets and restaurants`)}</h1>
      </div>

      <div className="row" role="tablist" aria-label={t("المدينة", "City")}>
        {HOLY_CITIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === city}
            className={`btn ${c === city ? "" : "ghost"}`}
            onClick={() => {
              setCity(c);
              setCategory(null);
            }}
          >
            {cityName(c, lang)}
          </button>
        ))}
      </div>
      {categories.length > 1 && (
        <div className="row">
          <button type="button" className={`chip ${!category ? "info" : "muted"}`} onClick={() => setCategory(null)}>{t("الكل", "All")}</button>
          {categories.map((c) => (
            <button key={c} type="button" className={`chip ${category === c ? "info" : "muted"}`} onClick={() => setCategory(c)}>
              {placeCategory(c, lang)}
            </button>
          ))}
        </div>
      )}

      {places === null ? (
        <Loading />
      ) : !shown.length ? (
        <p className="muted">{t("لم تُضف أماكن لهذه المدينة بعد.", "No places added for this city yet.")}</p>
      ) : (
        <ul className="list">
          {shown.map((p) => (
            <li key={p.id} className="req-row">
              <div className="row spread">
                <b>{lang === "en" && p.name_en ? p.name_en : p.name_ar}</b>
                <span className="chip muted">{placeCategory(p.category, lang)}</span>
              </div>
              {(lang === "en" ? p.about_en || p.about_ar : p.about_ar) && (
                <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{lang === "en" ? p.about_en || p.about_ar : p.about_ar}</p>
              )}
              <div className="row small muted">
                {p.hours && <span>{p.hours}</span>}
                {p.address && <span>{p.address}</span>}
                {p.map_url && (
                  <a href={p.map_url} target="_blank" rel="noreferrer">
                    {t("الخريطة", "Map")}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
