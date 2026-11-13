import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://hamlaty.co"),
  title: "حملتي — عروض فنادق الزيارة لحملات العراق | Hamlaty",
  description: "منصة تربط حملات الزيارة بفنادق كربلاء والنجف والكاظمية وسامراء: طلب واحد، عروض متعددة، حجز مؤكد.",
  applicationName: "حملتي Hamlaty",
  // Opened from the iPhone home screen, Hamlaty runs full screen like an app.
  appleWebApp: { capable: true, title: "حملتي", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F1EA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" translate="no" suppressHydrationWarning>
      <head>
        {/* Browser auto-translation rewrites the page text and crashes the app; the site has its own Arabic/English switch. */}
        <meta name="google" content="notranslate" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@600;700;800&family=Readex+Pro:wght@500;600&family=IBM+Plex+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
