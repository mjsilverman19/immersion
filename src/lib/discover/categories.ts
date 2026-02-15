import type { PlaceCategory } from "@/lib/types/database";
import type { CategoryPreference } from "@/constants/tags";

/** Maps a place category to its parent preference group */
export const CATEGORY_TO_PREFERENCE: Record<PlaceCategory, CategoryPreference> = {
  restaurant: "Eating & Drinking",
  cafe: "Eating & Drinking",
  bar: "Eating & Drinking",
  shop: "Shopping & Markets",
  park: "Outdoors & Neighborhoods",
  viewpoint: "Culture & Sights",
  experience: "Culture & Sights",
};

/** Filter categories for the UI pill buttons */
export const FILTER_CATEGORIES = [
  { label: "All", value: null },
  { label: "Restaurants", value: "restaurant" as PlaceCategory },
  { label: "Cafes", value: "cafe" as PlaceCategory },
  { label: "Bars", value: "bar" as PlaceCategory },
  { label: "Shops", value: "shop" as PlaceCategory },
  { label: "Parks", value: "park" as PlaceCategory },
  { label: "Sights", value: "viewpoint" as PlaceCategory },
  { label: "Experiences", value: "experience" as PlaceCategory },
] as const;
