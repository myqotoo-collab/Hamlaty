// Texts the other party after a step in the booking flow. Called by the browser right after the step succeeds:
//   POST /api/notify  { event, id }   with the user's "Authorization: Bearer <access token>"
// The server checks that the caller really is the party who could take that step, then finds the recipients
// itself (the browser never chooses who gets a message). Each message is sent at most once (notifications table).
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { notify, texts } from "@/lib/notify";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Event = "dispatched" | "offer_sent" | "flight_offer_sent" | "booked" | "provider_confirmed" | "fee_paid" | "cancelled";
const EVENTS: Event[] = ["dispatched", "offer_sent", "flight_offer_sent", "booked", "provider_confirmed", "fee_paid", "cancelled"];

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function memberOf(db: SupabaseClient, userId: string, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  const { data } = await db.from("memberships").select("org_id").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  return !!data;
}

async function isAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("is_admin").eq("user_id", userId).maybeSingle();
  return !!data?.is_admin;
}

const providerPath = (kind: string, offerId: string | null) => (kind === "flight" ? `/agency/offers/${offerId}` : `/hotel/offers/${offerId}`);

export async function POST(req: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ ok: false, error: "server keys missing" }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const userId = u?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { event?: string; id?: string };
  const event = body.event as Event;
  const id = String(body.id ?? "");
  if (!EVENTS.includes(event) || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const results: string[] = [];

  if (event === "dispatched") {
    const { data: r } = await db.from("group_requests").select("id, ref, pilgrims, campaign_id").eq("id", id).maybeSingle();
    if (!r || !(await memberOf(db, userId, r.campaign_id))) return NextResponse.json({ ok: false }, { status: 403 });
    const [{ data: hotels }, { data: offices }] = await Promise.all([
      db.from("offers").select("id, hotel_id").eq("request_id", id).eq("status", "draft"),
      db.from("flight_offers").select("id, agency_id").eq("request_id", id).eq("status", "draft"),
    ]);
    for (const o of hotels ?? []) results.push(await notify(db, o.hotel_id, "new_request", o.id, texts.new_request(r.ref, r.pilgrims, `/hotel/offers/${o.id}`)));
    for (const o of offices ?? []) results.push(await notify(db, o.agency_id, "new_request", o.id, texts.new_request(r.ref, r.pilgrims, `/agency/offers/${o.id}`)));
  }

  if (event === "offer_sent" || event === "flight_offer_sent") {
    const table = event === "offer_sent" ? "offers" : "flight_offers";
    const owner = event === "offer_sent" ? "hotel_id" : "agency_id";
    const { data: o } = await db.from(table).select(`id, status, request_id, ${owner}`).eq("id", id).maybeSingle();
    const row = o as Record<string, string> | null;
    if (!row || row.status !== "sent" || !(await memberOf(db, userId, row[owner]))) return NextResponse.json({ ok: false }, { status: 403 });
    const { data: r } = await db.from("group_requests").select("id, ref, campaign_id").eq("id", row.request_id).maybeSingle();
    if (r) results.push(await notify(db, r.campaign_id, "offer_sent", row.id, texts.offer_sent(r.ref, r.id)));
  }

  if (["booked", "provider_confirmed", "fee_paid", "cancelled"].includes(event)) {
    const { data: b } = await db
      .from("bookings")
      .select("id, ref, kind, status, request_id, offer_id, flight_offer_id, campaign_id, hotel_id, agency_id, fee_minor, fee_currency")
      .eq("id", id)
      .maybeSingle();
    if (!b) return NextResponse.json({ ok: false }, { status: 404 });
    const provider = b.hotel_id ?? b.agency_id;
    const path = providerPath(b.kind, b.offer_id ?? b.flight_offer_id);
    const campaignPath = `/campaign/requests/${b.request_id}`;

    if (event === "booked") {
      if (!(await memberOf(db, userId, b.campaign_id))) return NextResponse.json({ ok: false }, { status: 403 });
      results.push(await notify(db, provider, "offer_accepted", b.id, texts.offer_accepted(b.ref, path)));
    }
    if (event === "provider_confirmed") {
      if (b.status !== "awaiting_payment" || !(await memberOf(db, userId, provider))) return NextResponse.json({ ok: false }, { status: 403 });
      results.push(await notify(db, b.campaign_id, "fee_due", b.id, texts.fee_due(b.ref, money(b.fee_minor, b.fee_currency, "ar"), b.request_id)));
    }
    if (event === "fee_paid") {
      if (b.status !== "confirmed" || !(await isAdmin(db, userId))) return NextResponse.json({ ok: false }, { status: 403 });
      results.push(await notify(db, b.campaign_id, "booking_confirmed", b.id, texts.booking_confirmed(b.ref, campaignPath)));
      results.push(await notify(db, provider, "booking_confirmed", b.id, texts.booking_confirmed(b.ref, path)));
    }
    if (event === "cancelled") {
      const byCampaign = await memberOf(db, userId, b.campaign_id);
      const byProvider = await memberOf(db, userId, provider);
      if (b.status !== "cancelled" || !(byCampaign || byProvider)) return NextResponse.json({ ok: false }, { status: 403 });
      if (byCampaign) results.push(await notify(db, provider, "booking_cancelled", b.id, texts.booking_cancelled(b.ref, path)));
      if (byProvider) results.push(await notify(db, b.campaign_id, "booking_cancelled", b.id, texts.booking_cancelled(b.ref, campaignPath)));
    }
  }

  return NextResponse.json({ ok: true, results });
}
