import { describe, expect, it } from "vitest";

import { selectRecommendedSet } from "@/lib/recommendations";
import type { VenueRecord } from "@/types/data";

const at = (id: string, lat: number, lng: number, category: VenueRecord["category"]): VenueRecord => ({
  id,
  name: id,
  latitude: lat,
  longitude: lng,
  h3: "h",
  neighborhoodId: "area",
  category,
  qualityPrior: 0.6,
  qualityConfidence: 1,
  qualitySource: "engine_prior",
  featureScores: { informal: 0.5, novel: 0.5, institution: 0.5, soloFriendly: 0.5, linger: 0.5, destination: 0.5, evidenceConfidence: 0.5 },
});

describe("selectRecommendedSet", () => {
  it("prefers a spread-out venue over stacking near-duplicates on one block", () => {
    // Five nearly-identical restaurants on the same corner, plus one slightly
    // lower-scored restaurant across the neighborhood.
    const ranked = [
      { venue: at("a", 40.700, -73.990, "restaurant"), score: 100 },
      { venue: at("b", 40.7001, -73.9901, "restaurant"), score: 99 },
      { venue: at("c", 40.7002, -73.9902, "restaurant"), score: 98 },
      { venue: at("d", 40.7003, -73.9903, "restaurant"), score: 97 },
      { venue: at("e", 40.7004, -73.9904, "restaurant"), score: 96 },
      { venue: at("far", 40.720, -73.950, "restaurant"), score: 90 },
    ];
    const chosen = selectRecommendedSet(ranked);
    expect(chosen.size).toBe(5);
    // The far venue displaces one of the stacked near-duplicates despite a lower score.
    expect(chosen.has(5)).toBe(true);
    expect(chosen.has(0)).toBe(true); // the top pick is always kept
  });

  it("keeps everything when there are no more than five candidates", () => {
    const ranked = [0, 1, 2].map((i) => ({ venue: at(`v${i}`, 40.7 + i * 0.01, -73.99, "bar"), score: 10 - i }));
    expect(selectRecommendedSet(ranked)).toEqual(new Set([0, 1, 2]));
  });
});
