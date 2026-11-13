"use client";
// Last-resort error page for failures outside any page (root layout, language provider, loading the app's scripts).
// It replaces the whole document, so it carries its own minimal styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(error.message);
  return (
    <html lang="ar" dir="rtl" translate="no">
      <body style={{ margin: 0, fontFamily: "system-ui, Tahoma, sans-serif", background: "#f3f5f4", color: "#16201f" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", display: "grid", gap: 12 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>{chunk ? "صدر تحديث جديد للموقع" : "حدث خطأ أثناء تحميل الموقع"}</h1>
          <p style={{ margin: 0 }} dir="ltr" lang="en">
            {chunk ? "A new version of the site was published. Reload the page." : "Something went wrong while loading the site."}
          </p>
          {!chunk && (
            <pre dir="ltr" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fff", border: "1px solid #d3dad7", borderRadius: 8, padding: 12, fontSize: 13, margin: 0 }}>
              {error.name}: {error.message}
              {error.digest ? `\n(${error.digest})` : ""}
              {error.stack ? `\n\n${error.stack.split("\n").slice(0, 6).join("\n")}` : ""}
            </pre>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => (chunk ? location.reload() : reset())} style={{ font: "inherit", fontWeight: 600, padding: "10px 16px", borderRadius: 8, border: "1px solid #0f5c63", background: "#0f5c63", color: "#fff" }}>
              إعادة المحاولة · Try again
            </button>
            <button onClick={() => location.reload()} style={{ font: "inherit", padding: "10px 16px", borderRadius: 8, border: "1px solid #d3dad7", background: "transparent", color: "#16201f" }}>
              تحديث الصفحة · Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
