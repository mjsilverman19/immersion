/**
 * Venue-to-venue retrieval over the precomputed place-neighbor index.
 *
 * The engine ships per-channel similarity (see immersion_data/pipeline/
 * compute_place_neighbors.py); this module is the runtime half: the taste quiz
 * sets channel *weights* (not the representation), a soft quality gate keeps weak
 * venues from surfacing, and reason text is reconstructed from the scores. Pure
 * functions only — no React, no data loading — so retrieval quality is unit
 * testable in isolation.
 */
import type {
  CategoryCurves,
  ComplementFactor,
  ComplementNeighbor,
  ComplementResult,
  SimilarChannel,
  SimilarNeighbor,
  SimilarResult,
  TasteProfile,
  VenueRecord,
} from "@/types/data";

export type SimilarWeights = Record<SimilarChannel, number>;

/** Default channel blend, mirroring the engine's SIMILAR_WEIGHTS. */
export const DEFAULT_SIMILAR_WEIGHTS: SimilarWeights = {
  time: 0.2,
  ecology: 0.28,
  area: 0.18,
  category: 0.12,
  spend: 0.1,
  role: 0.12,
};

const COMPLEMENT_WEIGHTS: Record<ComplementFactor, number> = { walk: 0.4, complement: 0.4, area: 0.2 };

const CHANNEL_REASON: Record<Exclude<SimilarChannel, "category">, string> = {
  time: "Similar weekly rhythm",
  ecology: "Comparable neighborhood mix",
  area: "Similar area character",
  spend: "Similar price and quality",
  role: "Similar role in an outing",
};

const REASON_MIN_SCORE = 0.6;
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

/**
 * Turn a taste profile into channel weights. The quiz dimensions nudge the
 * default blend — wandering favours ecology (or role when it points at "one
 * anchor"), neighborhood-orientation favours area character, novelty away from
 * raw category, formality toward spend, energy toward rhythm — scaled by the
 * profile's confidence so a thin profile barely moves the baseline. Weights are
 * floored and renormalised to sum to 1.
 */
export function lensWeightsFromTaste(profile: TasteProfile | null): SimilarWeights {
  const weights: SimilarWeights = { ...DEFAULT_SIMILAR_WEIGHTS };
  if (!profile) return weights;
  const gain = 0.14 * clamp(profile.confidence, 0, 1);
  weights.ecology += gain * Math.max(0, profile.wandering);
  weights.role += gain * Math.max(0, -profile.wandering);
  weights.area += gain * Math.abs(profile.neighborhoodOrientation);
  weights.ecology += gain * Math.max(0, profile.novelty);
  weights.category -= gain * Math.max(0, profile.novelty);
  weights.spend += gain * Math.max(0, profile.formality);
  weights.time += gain * Math.max(0, profile.energy);
  return normalizeWeights(weights);
}

function normalizeWeights(weights: SimilarWeights): SimilarWeights {
  const floored = Object.fromEntries(
    (Object.keys(weights) as SimilarChannel[]).map((key) => [key, Math.max(0.02, weights[key])]),
  ) as SimilarWeights;
  const total = (Object.values(floored) as number[]).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(
    (Object.keys(floored) as SimilarChannel[]).map((key) => [key, floored[key] / total]),
  ) as SimilarWeights;
}

/** Soft quality gate: weak venues are discounted, not removed, so a strong
 * similarity still surfaces a lesser-rated place. Mirrors R = S_sim · G(q). */
function qualityGate(qualityPrior: number): number {
  return clamp(0.3 + 0.7 * qualityPrior, 0, 1);
}

function similarReasons(seed: VenueRecord, neighbor: SimilarNeighbor): string[] {
  const order: SimilarChannel[] = ["time", "ecology", "area", "category", "spend", "role"];
  const ranked = order
    .map((channel) => ({ channel, score: neighbor.scores[channel] }))
    .sort((a, b) => b.score - a.score || DEFAULT_SIMILAR_WEIGHTS[b.channel] - DEFAULT_SIMILAR_WEIGHTS[a.channel]);
  const reasons: string[] = [];
  for (const { channel, score } of ranked) {
    if (score < REASON_MIN_SCORE || reasons.length === 2) break;
    reasons.push(
      channel === "category"
        ? neighbor.venue.category === seed.category
          ? "Same kind of place"
          : "A compatible kind of place"
        : CHANNEL_REASON[channel],
    );
  }
  return reasons.length ? reasons : ["Broadly comparable"];
}

export interface SimilarOptions {
  weights?: SimilarWeights;
  limit?: number;
  /** At most this many results per neighborhood, for geographic variety. */
  perNeighborhoodCap?: number;
}

/**
 * Rank "more like this" candidates for a seed venue. Blends the per-channel
 * similarities with the (lens-derived) weights, applies the quality gate, caps
 * per-neighborhood repetition for variety, and attaches reasons.
 */
export function rankSimilar(
  seed: VenueRecord,
  neighbors: SimilarNeighbor[],
  options: SimilarOptions = {},
): SimilarResult[] {
  const weights = options.weights ?? DEFAULT_SIMILAR_WEIGHTS;
  const limit = options.limit ?? 10;
  const perNeighborhoodCap = options.perNeighborhoodCap ?? Infinity;
  const scored = neighbors
    .map((neighbor) => {
      const blended = (Object.keys(weights) as SimilarChannel[]).reduce(
        (sum, channel) => sum + weights[channel] * neighbor.scores[channel],
        0,
      );
      return {
        venue: neighbor.venue,
        score: blended * qualityGate(neighbor.venue.qualityPrior),
        scores: neighbor.scores,
        reasons: similarReasons(seed, neighbor),
      };
    })
    .sort((a, b) => b.score - a.score);

  const perNeighborhood = new Map<string, number>();
  const results: SimilarResult[] = [];
  for (const item of scored) {
    if (results.length >= limit) break;
    const key = item.venue.neighborhoodId ?? "";
    const used = perNeighborhood.get(key) ?? 0;
    if (key && used >= perNeighborhoodCap) continue;
    perNeighborhood.set(key, used + 1);
    results.push(item);
  }
  return results;
}

function complementReasons(seed: VenueRecord, neighbor: ComplementNeighbor): string[] {
  const minutes = Math.max(1, Math.round(neighbor.distanceMeters / 80));
  const reasons = [`${minutes} min walk`];
  if (neighbor.venue.category !== seed.category) reasons.push(`Adds ${neighbor.venue.category} to the outing`);
  if (neighbor.role === "after") reasons.push("Tends to work later");
  else if (neighbor.role === "before") reasons.push("A good lead-in");
  return reasons.slice(0, 3);
}

export interface ComplementOptions {
  limit?: number;
  /** Optional time context; when given, candidates are nudged by their category's
   * relevance at the *next* hour, so a natural next stop rises. */
  dayOfWeek?: number;
  hour?: number;
  categoryCurves?: CategoryCurves | null;
  /** At most this many results per category, for variety across an outing. */
  perCategoryCap?: number;
}

function nextHourRelevance(venue: VenueRecord, options: ComplementOptions): number {
  const { categoryCurves, dayOfWeek, hour } = options;
  if (!categoryCurves || dayOfWeek === undefined || hour === undefined) return 1;
  const curve = categoryCurves[venue.category];
  if (!curve) return 1;
  const nextHour = (hour + 1) % 24;
  return curve[dayOfWeek * 24 + nextHour] ?? 0.5;
}

/**
 * Rank "continue from here" complements: nearby, complementary venues. Blends
 * walk/complement/area factors, optionally lifts candidates that are relevant at
 * the next hour, and keeps category variety across the outing.
 */
export function rankComplements(
  seed: VenueRecord,
  neighbors: ComplementNeighbor[],
  options: ComplementOptions = {},
): ComplementResult[] {
  const limit = options.limit ?? 6;
  const perCategoryCap = options.perCategoryCap ?? 2;
  const scored = neighbors
    .map((neighbor) => {
      const blended = (Object.keys(COMPLEMENT_WEIGHTS) as ComplementFactor[]).reduce(
        (sum, factor) => sum + COMPLEMENT_WEIGHTS[factor] * neighbor.scores[factor],
        0,
      );
      return {
        venue: neighbor.venue,
        distanceMeters: neighbor.distanceMeters,
        role: neighbor.role,
        score: blended * (0.6 + 0.4 * nextHourRelevance(neighbor.venue, options)),
        reasons: complementReasons(seed, neighbor),
      };
    })
    .sort((a, b) => b.score - a.score);

  const perCategory = new Map<string, number>();
  const results: ComplementResult[] = [];
  for (const item of scored) {
    if (results.length >= limit) break;
    const used = perCategory.get(item.venue.category) ?? 0;
    if (used >= perCategoryCap) continue;
    perCategory.set(item.venue.category, used + 1);
    results.push(item);
  }
  return results;
}
