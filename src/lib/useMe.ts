"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import type { Org } from "./types";

export interface Me {
  userId: string;
  phone: string | null;
  org: Org | null;
  role: string | null;
  isAdmin: boolean;
}

type Need = "any" | "campaign" | "hotel" | "admin" | "no-org";

/**
 * Loads the signed-in user and their organisation, and sends them where they belong:
 * no session → /login, no organisation → /onboarding, wrong area → their home.
 */
export function useMe(need: Need = "any") {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await loadMe();
        if (cancelled) return;
        if (!value) {
          rememberNext();
          return router.replace("/login");
        }
        const org = value.org;
        if (need === "admin" && !value.isAdmin) return router.replace(homeFor(value));
        if (need !== "admin" && need !== "no-org" && !org) return router.replace("/onboarding");
        if (need === "no-org" && org) return router.replace(takeNext() ?? homeFor(value));
        if ((need === "campaign" || need === "hotel") && org && org.kind !== need) return router.replace(homeFor(value));
        setMe(value);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [need, router]);

  return { me, error };
}

// Pages a signed-out visitor may be sent back to after signing in (links in SMS messages).
const NEXT_OK = /^\/(campaign|hotel)\/[^/]/;

function rememberNext() {
  try {
    const p = window.location.pathname + window.location.search;
    if (NEXT_OK.test(p)) sessionStorage.setItem("hamlaty-next", p);
  } catch {}
}

/** The remembered page, once. Only same-site links are honoured. */
export function takeNext(): string | null {
  try {
    const p = sessionStorage.getItem("hamlaty-next");
    sessionStorage.removeItem("hamlaty-next");
    return p && NEXT_OK.test(p) ? p : null;
  } catch {
    return null;
  }
}

export function homeFor(me: Pick<Me, "org" | "isAdmin">): string {
  if (!me.org) return me.isAdmin ? "/admin" : "/onboarding";
  return me.org.kind === "hotel" ? "/hotel" : "/campaign";
}

/** The signed-in user with their organisation, or null when signed out. No redirects. */
export async function loadMe(): Promise<Me | null> {
  const sb = supabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;
  const uid = session.user.id;
  const [{ data: mem, error: e1 }, { data: prof }] = await Promise.all([
    sb.from("memberships").select("role, org:organizations(*)").eq("user_id", uid).limit(1).maybeSingle(),
    sb.from("profiles").select("is_admin").eq("user_id", uid).maybeSingle(),
  ]);
  if (e1) throw e1;
  return {
    userId: uid,
    phone: session.user.phone ?? null,
    org: ((mem as { org?: Org } | null)?.org ?? null) as Org | null,
    role: (mem as { role?: string } | null)?.role ?? null,
    isAdmin: !!prof?.is_admin,
  };
}

/** For public pages: the user if signed in, otherwise null, without redirecting. */
export function useOptionalMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    loadMe().then(setMe).catch(() => setMe(null));
  }, []);
  return me;
}
