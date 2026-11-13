"use client";
// Shown instead of a blank "Application error" page, with the actual cause, in both languages.
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const missingKeys = /Supabase URL or key is missing/i.test(error.message);

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <div className="panel">
        <h1 style={{ fontSize: 20 }}>{missingKeys ? "الموقع غير مربوط بقاعدة البيانات بعد" : "حدث خطأ غير متوقع"}</h1>
        <p className="muted" lang="en" dir="ltr">
          {missingKeys ? "The site isn’t connected to the database yet." : "Something went wrong."}
        </p>
        {missingKeys ? (
          <p className="small">
            أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel ← Settings ← Environment Variables، ثم أعد النشر (Redeploy).
          </p>
        ) : (
          <pre className="small" dir="ltr" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {error.name}: {error.message}
            {error.digest ? `\n(${error.digest})` : ""}
            {error.stack ? `\n\n${error.stack.split("\n").slice(0, 6).join("\n")}` : ""}
          </pre>
        )}
        <div>
          <button className="btn" onClick={reset}>
            حاول مرة أخرى · Try again
          </button>
        </div>
      </div>
    </main>
  );
}
