import type { FeatureCollection, Point } from "geojson";

/**
 * Opening hours, Mon..Sun (index 0 = Monday). Each day is either `null` (closed)
 * or a list of `[open, close]` pairs in minutes from midnight; a close past
 * midnight is encoded as > 1440 (e.g. 2am = 1560).
 */
export type WeekHours = (Array<[number, number]> | null)[];

/** The neighbourhood's rhythm, from the venue's hex — shares, not normalised. */
export interface TemporalSignature {
  weekday_evening: number;
  weekend_day: number;
  late_night: number;
}

/** A scored venue, as emitted by the Task 3 pipeline into venues.json. */
export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: "restaurant" | "bar" | "cafe" | "park" | "museum";
  price_tier: "$" | "$$" | "$$$" | "$$$$" | null;
  index_score: number;
  temporal_note: string;
  temporal_signature: TemporalSignature;
  /** Real hours from Places, or null when the source listed none. */
  hours: WeekHours | null;
  /** One honest, template-based line derived from the hours, or null. */
  factual_note: string | null;
  hex_id: string;
  neighborhood: string;
}

/** A user-facing filter chip. `id` is the value stored on each venue feature. */
export interface CategoryChip {
  id: string;
  label: string;
  /** Pipeline categories that roll up into this chip. */
  categories: Venue["category"][];
}

/** The chips pinned above the map, in display order. */
export const CATEGORY_CHIPS: CategoryChip[] = [
  { id: "eat", label: "Eat", categories: ["restaurant"] },
  { id: "drink", label: "Drink", categories: ["bar"] },
  { id: "coffee", label: "Coffee", categories: ["cafe"] },
  { id: "park", label: "Park", categories: ["park"] },
  { id: "culture", label: "Culture", categories: ["museum"] },
];

const CATEGORY_TO_CHIP: Record<Venue["category"], string> = Object.fromEntries(
  CATEGORY_CHIPS.flatMap((chip) => chip.categories.map((cat) => [cat, chip.id])),
) as Record<Venue["category"], string>;

/** The chip id a venue's category rolls up into. */
export const chipForCategory = (cat: Venue["category"]): string => CATEGORY_TO_CHIP[cat];

/** Feature properties carried on each venue point in the map source. */
export interface VenueFeatureProps {
  id: string;
  name: string;
  chip: string;
  category: Venue["category"];
  index_score: number;
  neighborhood: string;
  /**
   * Global score rank (0 = best citywide) and rank within the venue's chip
   * category. Reveal is a rank-vs-zoom `setFilter` (see MapCanvas) rather than a
   * live viewport query, so the best venues appear first, the set densifies as
   * you zoom, and panning never janks.
   */
  score_rank: number;
  cat_rank: number;
}

/**
 * Convert the flat venue list into a GeoJSON FeatureCollection for MapLibre.
 * Each feature carries its `chip` id (for synchronous category filtering) and its
 * global + per-category score rank (for zoom-gated reveal). Higher-scoring venues
 * are placed later so they draw on top.
 */
export function venuesToGeoJSON(
  venues: Venue[],
): FeatureCollection<Point, VenueFeatureProps> {
  const byScore = [...venues].sort((a, b) => b.index_score - a.index_score);
  const globalRank = new Map<string, number>();
  byScore.forEach((v, i) => globalRank.set(v.id, i));

  // Per-category rank, in the same score order.
  const catCount = new Map<Venue["category"], number>();
  const catRank = new Map<string, number>();
  for (const v of byScore) {
    const r = catCount.get(v.category) ?? 0;
    catRank.set(v.id, r);
    catCount.set(v.category, r + 1);
  }

  // Ascending score so the strongest venues draw last (on top).
  const sorted = [...venues].sort((a, b) => a.index_score - b.index_score);
  return {
    type: "FeatureCollection",
    features: sorted.map((v) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id,
        name: v.name,
        chip: CATEGORY_TO_CHIP[v.category],
        category: v.category,
        index_score: v.index_score,
        neighborhood: v.neighborhood,
        score_rank: globalRank.get(v.id) ?? 0,
        cat_rank: catRank.get(v.id) ?? 0,
      },
    })),
  };
}
