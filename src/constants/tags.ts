import type { PlaceCategory } from "@/lib/types/database";

export const VIBE_TAGS = [
  "neighborhood staple",
  "one-of-a-kind",
  "no-frills",
  "worth the wait",
  "go alone",
  "date-worthy",
  "late night",
  "morning ritual",
  "order everything",
  "local institution",
  "cash only",
  "outdoor seating",
  "off the beaten path",
  "reservations recommended",
  "group-friendly",
  "splurge-worthy",
  "hole in the wall",
  "people-watching",
  "quiet",
  "lively",
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

export const CATEGORY_PREFERENCES = [
  "Eating & Drinking",
  "Culture & Sights",
  "Shopping & Markets",
  "Outdoors & Neighborhoods",
] as const;

export type CategoryPreference = (typeof CATEGORY_PREFERENCES)[number];

/** @deprecated Use VIBE_TAGS instead. Kept for backwards compatibility. */
export const CATEGORY_TAGS: Record<PlaceCategory, string[]> = {
  restaurant: [
    "worth the wait",
    "hidden gem",
    "great for dates",
    "solo-friendly",
    "outdoor seating",
    "late night",
    "budget",
    "splurge",
  ],
  cafe: [
    "worth the wait",
    "hidden gem",
    "great for dates",
    "solo-friendly",
    "outdoor seating",
    "late night",
    "budget",
    "splurge",
  ],
  bar: [
    "worth the wait",
    "hidden gem",
    "great for dates",
    "solo-friendly",
    "outdoor seating",
    "late night",
    "budget",
    "splurge",
  ],
  park: [
    "sunrise spot",
    "sunset spot",
    "off the beaten path",
    "family-friendly",
    "quiet",
  ],
  viewpoint: [
    "sunrise spot",
    "sunset spot",
    "off the beaten path",
    "family-friendly",
    "quiet",
  ],
  shop: ["unique finds", "local goods", "budget", "splurge"],
  experience: ["bucket list", "repeat visit", "seasonal", "free"],
};

export const CATEGORY_MAP: Record<string, PlaceCategory> = {
  restaurant: "restaurant",
  food: "restaurant",
  meal_delivery: "restaurant",
  meal_takeaway: "restaurant",
  bar: "bar",
  night_club: "bar",
  cafe: "cafe",
  bakery: "cafe",
  park: "park",
  campground: "park",
  natural_feature: "park",
  shopping_mall: "shop",
  store: "shop",
  clothing_store: "shop",
  book_store: "shop",
  tourist_attraction: "viewpoint",
  church: "viewpoint",
  museum: "viewpoint",
  art_gallery: "viewpoint",
  point_of_interest: "experience",
  amusement_park: "experience",
  spa: "experience",
  gym: "experience",
  stadium: "experience",
};
