import type { Lang } from "./i18n";

export type OrgKind = "campaign" | "hotel";

export interface Org {
  id: string;
  kind: OrgKind;
  name: string;
  country: string;
  city: string | null;
  status: "pending" | "active" | "suspended";
  phone: string | null;
  cr_number: string | null;
  sms_notifications: boolean;
}

export type MealPlan = "room_only" | "breakfast" | "half_board" | "full_board";
export type RoomType = "single" | "double" | "triple" | "quad";

export interface HotelProfile {
  org_id: string;
  city: string;
  stars: number;
  distance_to_shrine_m: number;
  shrine: string | null;
  rooms_total: number | null;
  meals: MealPlan[];
  address: string | null;
  about: string | null;
  verified: boolean;
}

const pick = (pair: [string, string] | undefined, lang: Lang, fallback: string) => (pair ? pair[lang === "ar" ? 0 : 1] : fallback);

/** The holy cities hotels are in. Stored in Arabic; English is for display. */
export const HOLY_CITIES = ["كربلاء", "النجف", "الكاظمية", "سامراء"] as const;
const CITY_EN: Record<string, string> = { كربلاء: "Karbala", النجف: "Najaf", الكاظمية: "Kadhimiya", سامراء: "Samarra" };
export const cityName = (c: string, lang: Lang) => (lang === "en" ? CITY_EN[c] ?? c : c);

/** The main shrine in each city, offered as the default "distance to" landmark. */
export const SHRINES: Record<string, [string, string]> = {
  كربلاء: ["حرم الإمام الحسين (ع)", "Imam Hussain Shrine"],
  النجف: ["حرم الإمام علي (ع)", "Imam Ali Shrine"],
  الكاظمية: ["حرم الإمامين الكاظمين (ع)", "Al-Kadhimiya Shrine"],
  سامراء: ["حرم الإمامين العسكريين (ع)", "Al-Askari Shrine"],
};

/** Countries campaigns come from (ISO code → name). */
export const CAMPAIGN_COUNTRIES: Record<string, [string, string]> = {
  OM: ["عُمان", "Oman"],
  KW: ["الكويت", "Kuwait"],
  BH: ["البحرين", "Bahrain"],
  SA: ["السعودية", "Saudi Arabia"],
  AE: ["الإمارات", "UAE"],
  QA: ["قطر", "Qatar"],
  LB: ["لبنان", "Lebanon"],
  IQ: ["العراق", "Iraq"],
};
export const countryName = (c: string | null | undefined, lang: Lang) => (c ? pick(CAMPAIGN_COUNTRIES[c], lang, c) : "—");

const MEALS: Record<MealPlan, [string, string]> = {
  room_only: ["بدون وجبات", "Room only"],
  breakfast: ["فطور", "Breakfast"],
  half_board: ["فطور وعشاء", "Half board"],
  full_board: ["ثلاث وجبات", "Full board"],
};
export const MEAL_PLANS = Object.keys(MEALS) as MealPlan[];
export const mealName = (m: string, lang: Lang) => pick(MEALS[m as MealPlan], lang, m);

const ROOMS: Record<RoomType, [string, string]> = {
  single: ["مفردة", "Single"],
  double: ["ثنائية", "Double"],
  triple: ["ثلاثية", "Triple"],
  quad: ["رباعية", "Quad"],
};
export const roomName = (r: string, lang: Lang) => pick(ROOMS[r as RoomType], lang, r);

const REQUEST_STATUS: Record<string, [string, string]> = {
  open: ["بانتظار العروض", "Awaiting offers"],
  booked: ["محجوز", "Booked"],
  closed: ["مغلق", "Closed"],
  cancelled: ["ملغى", "Cancelled"],
};
export const requestStatus = (s: string, lang: Lang) => pick(REQUEST_STATUS[s], lang, s);

const OFFER_STATUS: Record<string, [string, string]> = {
  draft: ["بانتظار عرضك", "Awaiting your offer"],
  sent: ["أُرسل", "Sent"],
  declined: ["اعتذرت", "Declined"],
  accepted: ["تم الحجز", "Booked"],
  not_chosen: ["لم يُختر", "Not chosen"],
  expired: ["منتهي", "Expired"],
  withdrawn: ["مسحوب", "Withdrawn"],
};
export const offerStatus = (s: string, lang: Lang) => pick(OFFER_STATUS[s], lang, s);

const BOOKING_STATUS: Record<string, [string, string]> = {
  pending_hotel: ["بانتظار تأكيد الفندق", "Awaiting hotel confirmation"],
  confirmed: ["مؤكد", "Confirmed"],
  completed: ["مكتمل", "Completed"],
  cancelled: ["ملغى", "Cancelled"],
};
export const bookingStatus = (s: string, lang: Lang) => pick(BOOKING_STATUS[s], lang, s);
