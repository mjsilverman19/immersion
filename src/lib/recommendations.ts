import { metricAt } from "@/lib/baselineScore";
import { ENGINE_SCORING, INTENT_SCORING, SCORING, type IntentScoring } from "@/lib/config";
import {
  PERSONALIZATION_CAP,
  personalizeBaseline,
  personalizeBaselineVector,
  tasteContributions,
  tasteContributionsVector,
  tasteLens,
  type TasteLens,
  type TasteSignals,
} from "@/lib/personalization";
import { venueVector } from "@/lib/tasteSpace";
import { interpretableView } from "@/lib/tasteVector";
import type {
  CategoryCurves,
  HexGeometryCollection,
  HexTimeMetric,
  Intent,
  MapMode,
  MetricSlice,
  RadarEvidence,
  RankedVenue,
  ScoreContribution,
  SelectedArea,
  TasteProfile,
  TasteSpace,
  UserLocation,
  VenueRecord,
} from "@/types/data";

const INTENT_CATEGORIES: Record<Intent, VenueRecord["category"][]> = {
  anything: ["restaurant", "bar", "cafe", "museum", "park", "nightlife"],
  eat: ["restaurant"],
  drink: ["bar"],
  coffee: ["cafe"],
  culture: ["museum"],
  outside: ["park"],
  nightlife: ["nightlife", "bar"],
};

export const MIN_PERSONALIZED_GLOW_CONFIDENCE = 0.4;

interface RecommendationInput {
  geometry: HexGeometryCollection;
  metrics: MetricSlice;
  venues: VenueRecord[];
  categoryCurves: CategoryCurves | null;
  hour: number;
  intent: Intent;
  tasteProfile: TasteProfile | null;
  mapMode: MapMode;
  userLocation: UserLocation | null;
  /** Vector taste space (schema v5); null on legacy datasets or before load. */
  tasteSpace?: TasteSpace | null;
  /** venue id -> venues.json index, for taste-space vector lookup. */
  venueIndex?: Map<string, number> | null;
}

interface AreaDraft {
  id: string;
  name: string;
  borough: string;
  center: [number, number];
  h3Ids: string[];
  activeCells: Array<{ h3: string; score: number; confidence: number }>;
  activity: number;
  localOrientation: number;
  visitorPressure: number;
  confidence: number;
  diversity: number;
  wandering: number;
  relevantVenueCount: number;
  venueCount: number;
  venues: VenueRecord[];
  formalitySignal: number;
  distanceMiles?: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function intentDensity(features: HexGeometryCollection["features"][number]["properties"]["features"], intent: Intent): number {
  const densities: Record<Intent, number> = {
    anything: features.venueDensity,
    eat: features.foodDensity,
    drink: features.drinkDensity,
    coffee: features.coffeeDensity,
    culture: features.cultureDensity,
    outside: features.outdoorDensity,
    nightlife: Math.max(features.nightlifeDensity, features.drinkDensity),
  };
  return densities[intent];
}

function polygonCenter(coordinates: number[][][]): [number, number] {
  const ring = coordinates[0];
  const points = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  return [avg(points.map((point) => point[0])), avg(points.map((point) => point[1]))];
}

function percentileMap(values: Array<[string, number]>): Map<string, number> {
  const sorted = [...values].sort((a, b) => a[1] - b[1]);
  const result = new Map<string, number>();
  sorted.forEach(([id], index) => result.set(id, sorted.length <= 1 ? 1 : index / (sorted.length - 1)));
  return result;
}

export function categoriesForIntent(intent: Intent): VenueRecord["category"][] {
  return INTENT_CATEGORIES[intent];
}

export function venueMatchesIntent(venue: VenueRecord, intent: Intent): boolean {
  return INTENT_CATEGORIES[intent].includes(venue.category);
}

function haversineMiles(a: UserLocation, center: [number, number]): number {
  const radius = 3958.8;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(center[1] - a.latitude);
  const dLng = toRad(center[0] - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(center[1]);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function timeFit(venue: VenueRecord, curves: CategoryCurves | null, dayOfWeek: number, hour: number): number {
  const curve = curves?.[venue.category];
  return curve?.[dayOfWeek * 24 + hour] ?? 0.5;
}

/**
 * The multiplicative context terms of the recommender score, mirrored from the
 * offline engine (immersion_data/pipeline/assemble_scores.py). Each term relaxes
 * toward neutral (1.0) as its per-hex confidence falls, so a venue in a
 * thin-evidence cell scores close to pure quality rather than being penalised.
 * `metric` is null when the venue's hex has no metrics (outside the pilot
 * footprint) — every term is then exactly neutral.
 */
export function venueContextTerms(
  timeCurve: number,
  metric: HexTimeMetric | null,
  intent: IntentScoring = ENGINE_SCORING,
) {
  const time = SCORING.TIME_FLOOR + (1 - SCORING.TIME_FLOOR) * timeCurve;
  const a = metric?.activity ?? 0;
  const confA = metric?.activityConfidence ?? 0;
  // Activity is "busier is better" by default, but intent-relative when a target
  // is set: fit toward that buzz level, relaxing to neutral (1.0) as confidence
  // falls so a thin-evidence hex is never penalized either way.
  const activity = intent.activityTarget === undefined
    ? 1 - confA * 0.5 * (1 - a)
    : confA * Math.exp(-(intent.activityStrength ?? 3) * (a - intent.activityTarget) ** 2) + (1 - confA);
  const local = 1 + (metric?.localOrientationConfidence ?? 0) * intent.lambda * (metric?.localOrientation ?? 0);
  const tourist = 1 - (metric?.visitorPressureConfidence ?? 0) * intent.gamma * (metric?.visitorPressure ?? 0);
  return { time, activity, local, tourist };
}

/**
 * S(v,t): venue quality anchored, then contextualized by the hex's activity,
 * local likelihood, and tourist saturation at the selected hour. `qualityPrior`
 * is Q/100 (0..1); the score lands on a stable 0..100 display scale. `intent`
 * defaults to the engine-faithful constants (golden-parity path).
 */
export function venueBaseScore(
  qualityPrior: number,
  timeCurve: number,
  metric: HexTimeMetric | null,
  intent: IntentScoring = ENGINE_SCORING,
): number {
  const { time, activity, local, tourist } = venueContextTerms(timeCurve, metric, intent);
  return SCORING.SCALE * qualityPrior * time * activity * local * tourist;
}

function venueTasteSignals(venue: VenueRecord): TasteSignals {
  const scores = venue.featureScores;
  return {
    energy: venue.category === "nightlife" ? 1 : venue.category === "bar" ? 0.65 : venue.category === "cafe" || venue.category === "park" ? -0.45 : 0,
    novelty: scores.novel * 2 - 1,
    wandering: scores.linger * 2 - 1,
    formality: clamp01((1 - scores.informal + scores.destination) / 2) * 2 - 1,
    neighborhoodOrientation: 0,
  };
}

const chartValue = (value: number) => clamp01((value + 1) / 2);

/** The venue's interpretable 5-dim projection in the taste space, when both
 * the space and the venue's index are available. */
function venueView(space: TasteSpace | null | undefined, index: number | undefined) {
  if (!space || index === undefined) return null;
  return interpretableView(venueVector(space, index), space);
}

function venueRadarEvidence(
  venue: VenueRecord,
  draft: AreaDraft,
  space?: TasteSpace | null,
  index?: number,
): RadarEvidence {
  const view = venueView(space, index);
  const signals = venueTasteSignals(venue);
  const venueConfidence = venue.featureScores.evidenceConfidence;
  const areaOrientation = clamp01((draft.localOrientation - draft.visitorPressure + 1) / 2);
  return {
    values: {
      energy: chartValue(view ? view.energy : signals.energy),
      novelty: chartValue(view ? view.novelty : signals.novelty),
      wandering: chartValue(view ? view.wandering : signals.wandering),
      formality: chartValue(view ? view.formality : signals.formality),
      neighborhoodOrientation: areaOrientation,
    },
    confidence: {
      energy: Math.max(0.35, venueConfidence), novelty: venueConfidence, wandering: venueConfidence,
      formality: venueConfidence, neighborhoodOrientation: draft.confidence,
    },
    source: {
      energy: view ? "venue" : "category", novelty: "venue", wandering: "venue",
      formality: view ? "venue" : "category", neighborhoodOrientation: "area",
    },
  };
}

/**
 * Radar evidence for a venue viewed outside any area's ranking context (e.g.
 * surfaced through "more like this" retrieval, possibly in a neighborhood that
 * isn't currently a recommended area). With the taste space loaded, all five
 * values project from the venue's own fingerprint vector (its area channel
 * covers neighborhood orientation); on the legacy path, neighborhood
 * orientation has no area draft to draw on, so it reads as neutral with zero
 * confidence rather than guessing.
 */
export function standaloneRadarEvidence(
  venue: VenueRecord,
  space?: TasteSpace | null,
  index?: number,
): RadarEvidence {
  const view = venueView(space, index);
  const signals = venueTasteSignals(venue);
  const venueConfidence = venue.featureScores.evidenceConfidence;
  return {
    values: {
      energy: chartValue(view ? view.energy : signals.energy),
      novelty: chartValue(view ? view.novelty : signals.novelty),
      wandering: chartValue(view ? view.wandering : signals.wandering),
      formality: chartValue(view ? view.formality : signals.formality),
      neighborhoodOrientation: view ? chartValue(view.neighborhoodOrientation) : 0.5,
    },
    confidence: {
      energy: Math.max(0.35, venueConfidence), novelty: venueConfidence, wandering: venueConfidence,
      formality: venueConfidence, neighborhoodOrientation: view ? venueConfidence : 0,
    },
    source: {
      energy: view ? "venue" : "category", novelty: "venue", wandering: "venue",
      formality: view ? "venue" : "category", neighborhoodOrientation: view ? "venue" : "unknown",
    },
  };
}

/** A liveliness reason phrased for the intent: "busier is better" intents cite
 *  an unusually lively block; a target intent (e.g. quiet coffee) cites a buzz
 *  level close to what it wants. */
function activityContribution(metric: HexTimeMetric | null, intent: IntentScoring): ScoreContribution[] {
  if (!metric) return [];
  if (intent.activityTarget === undefined) {
    return metric.activity >= 0.5
      ? [{ feature: "activity", contribution: metric.activity * metric.activityConfidence, label: "Unusually lively at this time", evidenceConfidence: metric.activityConfidence }]
      : [];
  }
  const closeness = 1 - Math.min(1, Math.abs(metric.activity - intent.activityTarget) / 0.3);
  return closeness > 0.4
    ? [{ feature: "activity", contribution: closeness * metric.activityConfidence, label: "An easy-going buzz right now", evidenceConfidence: metric.activityConfidence }]
    : [];
}

const RECOMMENDED_SET_SIZE = 5;
// How hard to trade relevance for variety, and the distance (miles) at which two
// venues stop reading as "the same spot" (~2 short blocks).
const SET_DIVERSITY = 0.35;
const SET_DISTANCE_SCALE_MI = 0.12;

/**
 * Choose the shown set from the score-ranked list. Relevance still leads, but a
 * greedy MMR pass penalizes candidates that duplicate an already-picked venue's
 * block or category, so the surfaced 3–5 spread across the neighborhood instead
 * of stacking on one corner. Ranking (mapVenues) is untouched — this only
 * decides which venues carry the `isRecommended` flag.
 */
export function selectRecommendedSet(ranked: Array<{ venue: VenueRecord; score: number }>): Set<number> {
  if (ranked.length <= RECOMMENDED_SET_SIZE) return new Set(ranked.map((_, index) => index));
  const topScore = ranked[0].score || 1;
  const chosen: number[] = [];
  const remaining = new Set(ranked.map((_, index) => index));
  while (chosen.length < RECOMMENDED_SET_SIZE && remaining.size) {
    let best = -1;
    let bestValue = -Infinity;
    for (const i of remaining) {
      let maxSim = 0;
      for (const j of chosen) {
        const miles = haversineMiles(
          { latitude: ranked[i].venue.latitude, longitude: ranked[i].venue.longitude },
          [ranked[j].venue.longitude, ranked[j].venue.latitude],
        );
        const spatial = Math.exp(-miles / SET_DISTANCE_SCALE_MI);
        const sameCategory = ranked[i].venue.category === ranked[j].venue.category ? 1 : 0;
        maxSim = Math.max(maxSim, 0.6 * spatial + 0.4 * sameCategory);
      }
      const value = ranked[i].score / topScore - SET_DIVERSITY * maxSim;
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    chosen.push(best);
    remaining.delete(best);
  }
  return new Set(chosen);
}

function rankVenues(
  draft: AreaDraft,
  input: RecommendationInput,
  lens: TasteLens | null,
): RankedVenue[] {
  const eligible = draft.venues.filter((venue) => venueMatchesIntent(venue, input.intent) && venue.qualityPrior >= 0.2);
  const tasteActive = input.mapMode === "personalized" ? input.tasteProfile : null;
  const intentScoring = INTENT_SCORING[input.intent];
  const ranked = eligible.map((venue) => {
    const temporal = timeFit(venue, input.categoryCurves, input.metrics.dayOfWeek, input.hour);
    // Context comes from the venue's OWN hex at the selected hour; unsupported
    // cells (absent from the slice) leave every term neutral -> pure quality.
    const hexRecord = input.metrics.records[venue.h3];
    const metric = hexRecord ? metricAt(hexRecord, input.hour) : null;
    const terms = venueContextTerms(temporal, metric, intentScoring);
    const base = SCORING.SCALE * venue.qualityPrior * terms.time * terms.activity * terms.local * terms.tourist;
    const venueIdx = input.venueIndex?.get(venue.id);
    const vector = lens && input.tasteSpace && venueIdx !== undefined ? venueVector(input.tasteSpace, venueIdx) : undefined;
    const signals = venueTasteSignals(venue);
    // Taste is a bounded ±15% lever on top of the contextual score, never a
    // competing additive term. With the taste space loaded the match runs in
    // the fingerprint vector space; otherwise the legacy hand-signal path.
    const score = vector
      ? personalizeBaselineVector(base, lens, vector, venue.featureScores.evidenceConfidence, SCORING.VENUE_PERSONALIZATION_CAP)
      : personalizeBaseline(base, tasteActive, signals, venue.featureScores.evidenceConfidence, SCORING.VENUE_PERSONALIZATION_CAP);
    const contributions: ScoreContribution[] = [
      ...(venue.qualityPrior >= 0.6 ? [{ feature: "quality", contribution: venue.qualityPrior, label: "Highly rated for its kind", evidenceConfidence: venue.qualityConfidence }] : []),
      ...activityContribution(metric, intentScoring),
      ...(terms.local > 1.02 ? [{ feature: "local", contribution: terms.local - 1, label: "In tune with the neighborhood right now", evidenceConfidence: metric?.localOrientationConfidence ?? 0 }] : []),
      ...(temporal >= 0.55 ? [{ feature: "time", contribution: 0.5 * temporal, label: "A good time for this kind of place", evidenceConfidence: metric?.confidence ?? 0 }] : []),
      ...(vector
        ? tasteContributionsVector(lens, vector, venue.featureScores.evidenceConfidence)
        : tasteContributions(tasteActive, signals, venue.featureScores.evidenceConfidence)),
    ];
    return {
      venue,
      score,
      timeFit: temporal,
      radarEvidence: venueRadarEvidence(venue, draft, input.tasteSpace, venueIdx),
      contributions: contributions.filter((item) => item.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 3),
    };
  }).sort((a, b) => b.score - a.score);
  const recommendationLabel = input.mapMode === "personalized" && input.tasteProfile ? "People like you" as const : "Strong fit" as const;
  // Ranking is by score; the surfaced set is chosen for spread across the area.
  const recommended = selectRecommendedSet(ranked);
  return ranked.map((item, index) => ({ ...item, rank: index + 1, isRecommended: recommended.has(index), recommendationLabel }));
}

function categoryBenefit(intent: Intent): string {
  const labels: Record<Intent, string> = {
    anything: "A useful mix of places",
    eat: "Strong food options",
    drink: "Good places for a drink",
    coffee: "Strong coffee options",
    culture: "Culture worth making time for",
    outside: "Good options for time outside",
    nightlife: "Good options for going out",
  };
  return labels[intent];
}

export function buildAreaRecommendations(input: RecommendationInput): SelectedArea[] {
  const tasteHasEnoughEvidence = input.mapMode === "personalized"
    && Boolean(input.tasteProfile && input.tasteProfile.confidence >= MIN_PERSONALIZED_GLOW_CONFIDENCE);
  const effectiveInput = tasteHasEnoughEvidence ? input : { ...input, tasteProfile: null, mapMode: "baseline" as const };
  // Computed once per pass: the user's effective taste direction in the shipped
  // vector space. Null on legacy datasets, v2 profiles, or baseline mode — all
  // per-row scoring then falls back to the hand-signal path.
  const lens = effectiveInput.mapMode === "personalized"
    ? tasteLens(effectiveInput.tasteProfile, effectiveInput.tasteSpace ?? null)
    : null;
  const venuesByArea = new Map<string, VenueRecord[]>();
  input.venues.forEach((venue) => {
    if (!venue.neighborhoodId) return;
    const list = venuesByArea.get(venue.neighborhoodId) ?? [];
    list.push(venue);
    venuesByArea.set(venue.neighborhoodId, list);
  });
  const grouped = new Map<string, { features: HexGeometryCollection["features"]; centers: [number, number][] }>();
  for (const feature of input.geometry.features) {
    const id = feature.properties.neighborhoodId;
    if (!id || !input.metrics.records[feature.properties.h3]) continue;
    const current = grouped.get(id) ?? { features: [], centers: [] };
    current.features.push(feature);
    current.centers.push(polygonCenter(feature.geometry.coordinates));
    grouped.set(id, current);
  }
  const drafts: AreaDraft[] = [];
  for (const [id, group] of grouped) {
    const areaVenues = venuesByArea.get(id) ?? [];
    const relevant = areaVenues.filter((venue) => venueMatchesIntent(venue, input.intent));
    if (!relevant.length) continue;
    const timed = group.features.map((feature) => metricAt(input.metrics.records[feature.properties.h3], input.hour));
    const formalitySignal = areaVenues.length ? avg(areaVenues.map((venue) => clamp01((1 - venue.featureScores.informal + venue.featureScores.destination) / 2))) * 2 - 1 : 0;
    const activeCellDrafts = group.features.map((feature, index) => {
      const confidence = Math.min(timed[index].confidence, feature.properties.features.evidenceConfidence);
      const raw = 0.62 * timed[index].activity + 0.23 * intentDensity(feature.properties.features, input.intent) + 0.15 * feature.properties.features.wanderingScore;
      return { h3: feature.properties.h3, raw, confidence };
    });
    const cellRanks = percentileMap(activeCellDrafts.map((cell) => [cell.h3, cell.raw]));
    const activeCells = activeCellDrafts.map((cell) => ({
      h3: cell.h3,
      // Preserve absolute typical-time intensity so morning, afternoon, and
      // late-night patterns visibly differ; retain a smaller relative term so
      // the strongest nearby streets still read as a hierarchy.
      score: (0.75 * cell.raw + 0.25 * (cellRanks.get(cell.h3) ?? 0)) * (0.35 + 0.65 * cell.confidence),
      confidence: cell.confidence,
    }));
    const center: [number, number] = [avg(group.centers.map((point) => point[0])), avg(group.centers.map((point) => point[1]))];
    const borough = group.features[0].properties.borough ?? "New York";
    drafts.push({
      id, name: id, borough, center,
      h3Ids: group.features.map((feature) => feature.properties.h3), activeCells,
      activity: avg(timed.map((metric) => metric.activity)),
      localOrientation: avg(timed.map((metric) => metric.localOrientation)),
      visitorPressure: avg(timed.map((metric) => metric.visitorPressure)),
      confidence: avg(timed.map((metric) => metric.confidence)),
      diversity: avg(group.features.map((feature) => feature.properties.features.categoryDiversity)),
      wandering: avg(group.features.map((feature) => feature.properties.features.wanderingScore)),
      relevantVenueCount: relevant.length, venueCount: areaVenues.length, venues: areaVenues, formalitySignal,
      distanceMiles: input.userLocation ? haversineMiles(input.userLocation, center) : undefined,
    });
  }
  const activityRanks = percentileMap(drafts.map((area) => [area.id, area.activity]));
  const supplyRanks = percentileMap(drafts.map((area) => [area.id, Math.log1p(area.relevantVenueCount)]));
  let scored = drafts.map((draft) => {
    const activityRank = activityRanks.get(draft.id) ?? 0;
    const supplyRank = supplyRanks.get(draft.id) ?? 0;
    const backgroundAdjustment = clamp01(0.5 + 0.25 * (draft.localOrientation - draft.visitorPressure));
    const evidence = 0.45 * activityRank + 0.25 * supplyRank + 0.12 * draft.diversity + 0.13 * draft.wandering + 0.05 * backgroundAdjustment;
    const baselineScore = evidence * (0.75 + 0.25 * draft.confidence);
    const signals: TasteSignals = {
      energy: clamp01((draft.activity - 0.45) / 0.45) * 2 - 1,
      novelty: draft.diversity * 2 - 1,
      wandering: draft.wandering * 2 - 1,
      formality: draft.formalitySignal,
      neighborhoodOrientation: draft.localOrientation - draft.visitorPressure,
    };
    const activeTaste = effectiveInput.mapMode === "personalized" ? effectiveInput.tasteProfile : null;
    // Area taste runs against the neighborhood's venue-centroid vector when the
    // space is loaded. This deliberately trades the time-varying activity→energy
    // signal for a stable area character: taste is a stable preference and time
    // context already lives in the baseline score.
    const centroid = lens ? effectiveInput.tasteSpace?.areaCentroids.get(draft.id) : undefined;
    let score = centroid
      ? personalizeBaselineVector(baselineScore, lens, centroid, draft.confidence)
      : personalizeBaseline(baselineScore, activeTaste, signals, draft.confidence);
    if (draft.distanceMiles !== undefined) score *= 1 + 0.08 * Math.exp(-draft.distanceMiles / 1.5);
    const contributions: ScoreContribution[] = [
      { feature: "activity", contribution: 0.45 * activityRank, label: "The area has a strong rhythm at this time", evidenceConfidence: draft.confidence },
      { feature: "intent", contribution: 0.25 * supplyRank, label: `${categoryBenefit(input.intent)} nearby`, evidenceConfidence: 1 },
      ...(draft.wandering >= 0.35 ? [{ feature: "wandering", contribution: 0.13 * draft.wandering, label: "Several places are close enough to wander between", evidenceConfidence: draft.confidence }] : []),
      ...(centroid
        ? tasteContributionsVector(lens, centroid, draft.confidence)
        : tasteContributions(activeTaste, signals, draft.confidence)),
    ];
    return { draft, score, baselineScore, contributions: contributions.sort((a, b) => b.contribution - a.contribution).slice(0, 3) };
  });
  if (input.userLocation) {
    const near = scored.filter((item) => (item.draft.distanceMiles ?? Infinity) <= 3);
    if (near.length) scored = near;
  }
  const baselineOrder = [...scored].sort((a, b) => b.baselineScore - a.baselineScore);
  const baselineRanks = new Map(baselineOrder.map((item, index) => [item.draft.id, index + 1]));
  const personalizedOrder = [...scored].sort((a, b) => b.score - a.score);
  const personalizedRanks = percentileMap(personalizedOrder.map((item) => [item.draft.id, item.score]));
  return personalizedOrder.map(({ draft, score, baselineScore, contributions }, index) => {
    const personalizationLift = baselineScore > 0 ? score / baselineScore - 1 : 0;
    const activityStrength = activityRanks.get(draft.id) ?? 0;
    const tasteStrength = 0.7 * (personalizedRanks.get(draft.id) ?? 0)
      + 0.3 * clamp01(Math.max(0, personalizationLift) / PERSONALIZATION_CAP);
    const glowStrength = clamp01(
      (tasteHasEnoughEvidence ? tasteStrength : activityStrength) * (0.35 + 0.65 * draft.confidence),
    );
    const mapVenues = rankVenues(draft, effectiveInput, lens);
    return ({
    id: draft.id, name: draft.name, borough: draft.borough, center: draft.center, h3Ids: draft.h3Ids,
    activeCells: draft.activeCells,
    score, baselineScore, confidence: draft.confidence, venueCount: draft.venueCount,
    relevantVenueCount: draft.relevantVenueCount, contributions,
    mapVenues, recommendedVenues: mapVenues.filter((venue) => venue.isRecommended), distanceMiles: draft.distanceMiles,
    baselineRank: baselineRanks.get(draft.id) ?? index + 1,
    rankChange: (baselineRanks.get(draft.id) ?? index + 1) - (index + 1),
    personalizationLift,
    glowStrength,
    glowBasis: tasteHasEnoughEvidence ? "taste" : "activity",
    });
  });
}
