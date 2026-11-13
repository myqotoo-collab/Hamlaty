// Setup check, safe to open in a browser: says whether the server keys work, never shows them.
//   /api/health → { database, serviceKey, serviceKeyKind, sms }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { smsConfigured } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let serviceKey: "ok" | "missing" | "not_secret_key" | "wrong_key" = "missing";
  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    // Only the secret (service role) key may call this harmless function; a public key gets "permission denied".
    const { error } = await admin.rpc("internal_off");
    serviceKey = !error ? "ok" : /permission denied/i.test(error.message) ? "not_secret_key" : "wrong_key";
  }
  return NextResponse.json({
    database: url ? "ok" : "missing",
    serviceKey,
    serviceKeyKind: key ? (key.startsWith("sb_secret_") ? "sb_secret" : key.startsWith("sb_publishable_") ? "publishable (wrong)" : key.startsWith("eyJ") ? "jwt" : "unknown") : "missing",
    sms: smsConfigured() ? "set" : "missing",
  });
}
