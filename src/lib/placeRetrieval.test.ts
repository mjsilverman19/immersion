import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIMILAR_WEIGHTS,
  lensWeightsFromTaste,
  rankComplements,
  rankSimilar,
  type SimilarWeights,
} from "@/lib/placeRetrieval";
import type {
  ComplementNeighbor,
  SimilarChannel,
  SimilarNeighbor,
  TasteProfile,
  VenueRecord,
} from "@/types/data";

const venue = (
  id: string,
  category: VenueRecord["category"],
  qualityPrior = 0.7,
  neighborhoodId: string | null = "Area 1",
): VenueRecord => ({
  id, name: `Venue ${id}`, latitude: 40.72, longitude: -73.99, h3: `h-${id}`, neighborhoodId, category,
  qualityPrior, qualityConfidence: 1, qualitySource: "engine_prior",
  featureScores: { informal: 0.5, novel: 0.5, institution: 0.4, soloFriendly: 0.5, linger: 0.6, destination: 0.5, evidenceConfidence: 0.25 },
});

const zeros = (): Record<SimilarChannel, number> => ({ time: 0, ecology: 0, area: 0, category: 0, spend: 0, role: 0 });
const similar = (v: VenueRecord, scores: Partial<Record<SimilarChannel, number>>): SimilarNeighbor => ({ venue: v, scores: { ...zeros(), ...scores } });

const profile = (patch: Partial<TasteProfile>): TasteProfile => ({
  energy: 0, novelty: 0, wandering: 0, formality: 0, neighborhoodOrientation: 0, confidence: 1, version: 1, ...patch,
});

describe("lensWeightsFromTaste", () => {
  it("returns the default blend for no profile", () => {
    expect(lensWeightsFromTaste(null)).toEqual(DEFAULT_SIMILAR_WEIGHTS);
  });

  it("always produces positive weights that sum to 1", () => {
    const weights = lensWeightsFromTaste(profile({ wandering: 1, novelty: 1, energy: 1, formality: 1, neighborhoodOrientation: -1 }));
    const total = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
    for (const value of Object.values(weights) as number[]) expect(value).toBeGreaterThan(0);
  });

  it("up-weights ecology for a wanderer and role for an anchor-seeker", () => {
    const wander = lensWeightsFromTaste(profile({ wandering: 1 }));
    const anchor = lensWeightsFromTaste(profile({ wandering: -1 }));
    expect(wander.ecology).toBeGreaterThan(DEFAULT_SIMILAR_WEIGHTS.ecology);
    expect(anchor.role).toBeGreaterThan(wander.role);
  });

  it("barely moves a low-confidence profile", () => {
    const thin = lensWeightsFromTaste(profile({ wandering: 1, confidence: 0.05 }));
    expect(Math.abs(thin.ecology - DEFAULT_SIMILAR_WEIGHTS.ecology)).toBeLessThan(0.02);
  });
});

describe("rankSimilar", () => {
  const seed = venue("seed", "restaurant");

  it("orders by the weighted blend and re-ranks when weights change", () => {
    const ecologyHeavy = similar(venue("eco", "restaurant"), { ecology: 1 });
    const timeHeavy = similar(venue("time", "restaurant"), { time: 1 });
    const neighbors = [timeHeavy, ecologyHeavy];

    const ecologyLens: SimilarWeights = { ...zeros(), ecology: 1 };
    const timeLens: SimilarWeights = { ...zeros(), time: 1 };
    expect(rankSimilar(seed, neighbors, { weights: ecologyLens })[0].venue.id).toBe("eco");
    expect(rankSimilar(seed, neighbors, { weights: timeLens })[0].venue.id).toBe("time");
  });

  it("discounts weak venues via the quality gate", () => {
    const strong = similar(venue("strong", "restaurant", 1.0), { ecology: 0.8 });
    const weak = similar(venue("weak", "restaurant", 0.0), { ecology: 1.0 });
    const ranked = rankSimilar(seed, [weak, strong]);
    expect(ranked[0].venue.id).toBe("strong");
  });

  it("reconstructs reasons from the strongest channels", () => {
    const neighbor = similar(venue("c", "restaurant"), { time: 0.95, ecology: 0.9, category: 1 });
    const [result] = rankSimilar(seed, [neighbor]);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons).toContain("Same kind of place");
  });

  it("labels cross-category matches as compatible, not identical", () => {
    const neighbor = similar(venue("bar", "bar"), { category: 0.8, area: 0.9 });
    const [result] = rankSimilar(seed, [neighbor]);
    expect(result.reasons).not.toContain("Same kind of place");
  });

  it("caps repetition per neighborhood when asked", () => {
    const neighbors = [
      similar(venue("a1", "restaurant", 0.7, "Downtown"), { ecology: 0.9 }),
      similar(venue("a2", "restaurant", 0.7, "Downtown"), { ecology: 0.85 }),
      similar(venue("b1", "restaurant", 0.7, "Uptown"), { ecology: 0.8 }),
    ];
    const ranked = rankSimilar(seed, neighbors, { perNeighborhoodCap: 1 });
    expect(ranked.filter((r) => r.venue.neighborhoodId === "Downtown")).toHaveLength(1);
    expect(ranked.map((r) => r.venue.id)).toContain("b1");
  });

  it("respects the result limit", () => {
    const neighbors = Array.from({ length: 20 }, (_, i) => similar(venue(`v${i}`, "restaurant", 0.7, `N${i}`), { ecology: 1 - i / 100 }));
    expect(rankSimilar(seed, neighbors, { limit: 5 })).toHaveLength(5);
  });
});

describe("rankComplements", () => {
  const seed = venue("seed", "restaurant");
  const complement = (
    v: VenueRecord,
    scores: { walk: number; complement: number; area: number },
    distanceMeters = 200,
    role: ComplementNeighbor["role"] = "alongside",
  ): ComplementNeighbor => ({ venue: v, distanceMeters, role, scores });

  it("orders by the blended factor score", () => {
    const near = complement(venue("bar", "bar"), { walk: 1, complement: 1, area: 1 }, 80);
    const far = complement(venue("cafe", "cafe"), { walk: 0.2, complement: 0.3, area: 0.2 }, 700);
    expect(rankComplements(seed, [far, near])[0].venue.id).toBe("bar");
  });

  it("keeps category variety with a per-category cap", () => {
    const neighbors = [
      complement(venue("bar1", "bar"), { walk: 1, complement: 1, area: 1 }, 60),
      complement(venue("bar2", "bar"), { walk: 0.9, complement: 0.9, area: 0.9 }, 90),
      complement(venue("bar3", "bar"), { walk: 0.8, complement: 0.8, area: 0.8 }, 120),
      complement(venue("cafe1", "cafe"), { walk: 0.7, complement: 0.7, area: 0.7 }, 150),
    ];
    const ranked = rankComplements(seed, neighbors, { perCategoryCap: 2 });
    expect(ranked.filter((r) => r.venue.category === "bar")).toHaveLength(2);
    expect(ranked.map((r) => r.venue.id)).toContain("cafe1");
  });

  it("builds walk + role reasons", () => {
    const later = complement(venue("club", "nightlife"), { walk: 0.9, complement: 0.8, area: 0.7 }, 240, "after");
    const [result] = rankComplements(seed, [later]);
    expect(result.reasons[0]).toMatch(/min walk/);
    expect(result.reasons).toContain("Tends to work later");
    expect(result.reasons).toContain("Adds nightlife to the outing");
  });

  it("lifts candidates relevant at the next hour when time context is supplied", () => {
    const curves = {
      restaurant: Array(168).fill(0.1),
      bar: Array(168).fill(0.1),
      cafe: Array(168).fill(0.1),
      museum: Array(168).fill(0.1),
      park: Array(168).fill(0.1),
      nightlife: Array(168).fill(0.1),
    };
    // Make bar peak at the next hour (dow 0, hour 21) so it should outrank cafe.
    curves.bar[0 * 24 + 21] = 1;
    const barNeighbor = complement(venue("bar", "bar"), { walk: 0.6, complement: 0.6, area: 0.6 }, 300);
    const cafeNeighbor = complement(venue("cafe", "cafe"), { walk: 0.6, complement: 0.6, area: 0.6 }, 300);
    const ranked = rankComplements(seed, [cafeNeighbor, barNeighbor], { dayOfWeek: 0, hour: 20, categoryCurves: curves });
    expect(ranked[0].venue.id).toBe("bar");
  });
});
