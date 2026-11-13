import type { MetadataRoute } from "next";

// Lets people add Hamlaty to their home screen and open it like an app. On iPhone this also keeps them signed in:
// Safari clears a website's data after 7 days without a visit, but not for a home-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "حملتي Hamlaty",
    short_name: "حملتي",
    description: "عروض فنادق الزيارة لحملات العراق من عدة فنادق، وحجز مؤكد",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#1B1F3B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
