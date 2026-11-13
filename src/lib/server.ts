import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-side client with the secret key. Bypasses Row Level Security — use only after checking who is asking. */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Returns the user id behind a "Bearer <access token>" header, or null. */
export async function userFromRequest(req: Request, admin: SupabaseClient): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** True when the caller is a Hamlaty admin who passed the second check (asks the database, which applies aal2). */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const asUser = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await asUser.rpc("is_admin");
  return !error && data === true;
}
