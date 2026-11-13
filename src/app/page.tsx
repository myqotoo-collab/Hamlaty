"use client";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { useLang } from "@/lib/i18n";
import { homeFor, useOptionalMe } from "@/lib/useMe";

export default function Home() {
  const { t } = useLang();
  const me = useOptionalMe();

  return (
    <Shell me={me} isPublic className="home-page">
      <section className="hero">
        <span className="eyebrow">{t("كربلاء · النجف · الكاظمية · سامراء", "Karbala · Najaf · Kadhimiya · Samarra")}</span>
        <h1>{t("طلب واحد لحملتك، وعروض من عدة فنادق", "One request for your campaign, offers from several hotels")}</h1>
        <p>
          {t(
            "اكتب عدد الزوار والمدن والليالي، وتصلك عروض فنادق موثّقة بالمسافة إلى الحرم والسعر الكامل. قارن واحجز من مكان واحد.",
            "Enter your pilgrims, cities and nights, and get offers from verified hotels with the distance to the shrine and the full price. Compare and book in one place.",
          )}
        </p>
        <div className="hero-cta">
          {me?.org ? (
            <Link href={homeFor(me)} className="btn">
              {t("افتح حسابك", "Open your account")}
            </Link>
          ) : (
            <>
              <Link href="/login?as=campaign" className="btn">
                {t("ابدأ كمدير حملة", "Start as a campaign")}
              </Link>
              <Link href="/login?as=hotel" className="btn ghost">
                {t("سجّل فندقك", "List your hotel")}
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="side-cards" aria-label={t("كيف تعمل حملتي", "How Hamlaty works")}>
        <div className="side-card">
          <h2>{t("لمدير الحملة", "For campaign managers")}</h2>
          <ol className="steps">
            <li>
              <span>
                <b>{t("أرسل طلب المجموعة", "Send your group request")}</b>
                <span className="small muted">{t("الزوار، المدن، تواريخ الوصول، الغرف والوجبات.", "Pilgrims, cities, arrival dates, rooms and meals.")}</span>
              </span>
            </li>
            <li>
              <span>
                <b>{t("قارن العروض", "Compare the offers")}</b>
                <span className="small muted">{t("النجوم، المسافة إلى الحرم، والسعر الإجمالي جنباً إلى جنب.", "Stars, distance to the shrine and the total price side by side.")}</span>
              </span>
            </li>
            <li>
              <span>
                <b>{t("احجز، ويؤكد الفندق", "Book, and the hotel confirms")}</b>
                <span className="small muted">{t("بعد التأكيد تظهر لك بيانات الفندق كاملة.", "After confirming, you see the hotel's full details.")}</span>
              </span>
            </li>
          </ol>
        </div>
        <div className="side-card">
          <h2>{t("للفندق", "For hotels")}</h2>
          <ul className="trust">
            <li>{t("طلبات مجموعات حقيقية من حملات الخليج ولبنان، تصلك على الجوال.", "Real group requests from Gulf and Lebanese campaigns, straight to your phone.")}</li>
            <li>{t("التسجيل مجاني، وتدفع عمولة صغيرة فقط على الحجز المؤكد.", "Joining is free; you pay a small commission only on confirmed bookings.")}</li>
            <li>{t("العمولة تقل كلما تكرر حجز الحملة نفسها عندك.", "The commission falls each time the same campaign books you again.")}</li>
          </ul>
          <Link href="/login?as=hotel" className="btn teal">
            {t("سجّل فندقك مجاناً", "List your hotel for free")}
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>{t("لماذا حملتي؟", "Why Hamlaty?")}</h2>
        <ul className="trust">
          <li>{t("كل فندق يراجعه فريقنا: الصور، والمسافة الفعلية إلى الحرم.", "Our team checks every hotel: the photos and the real distance to the shrine.")}</li>
          <li>{t("السعر الذي تراه هو الإجمالي، تحسبه المنصة من أسعار الغرف ولا يتغير بعد الإرسال.", "The price you see is the total, computed by the platform from room prices, and it can't change once sent.")}</li>
          <li>{t("رابط تسجيل لزوار حملتك، وقائمة غرفهم في مكان واحد.", "A sign-up link for your pilgrims, and their room list in one place.")}</li>
        </ul>
      </section>
    </Shell>
  );
}
