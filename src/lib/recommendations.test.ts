import { describe, expect, it } from "vitest";

import { PERSONALIZATION_CAP, personalizeBaseline } from "@/lib/personalization";
import { buildAreaRecommendations } from "@/lib/recommendations";
import { mergeParallelStreetSegments } from "@/lib/streetGeometry";
import { learnTaste, tasteProfileFromAnswers } from "@/lib/tasteProfile";
import type { HexGeometryCollection, MetricSlice, TasteProfile, VenueRecord } from "@/types/data";

const profile = (energy: number, novelty: number, wandering: number): TasteProfile => ({ energy, novelty, wandering, formality: 0, neighborhoodOrientation: 0, confidence: 1, version: 1 });

const metric = (activity: number, confidence = 100): MetricSlice => ({ dayOfWeek: 6, intervalMinutes: 60, records: Object.fromEntries(["a", "b", "c", "d"].map((id, index) => [id, {
  activity: Array(24).fill(activity + index * 5), localOrientation: Array(24).fill(65), visitorPressure: Array(24).fill(15),
  confidence: { activity: confidence, localOrientation: confidence, visitorPressure: confidence },
}])) });

const geometry: HexGeometryCollection = { type: "FeatureCollection", features: ["a", "b", "c", "d"].map((id, index) => ({
  type: "Feature", id, geometry: { type: "Polygon", coordinates: [[[-74 + index * 0.01, 40.7], [-73.995 + index * 0.01, 40.7], [-73.995 + index * 0.01, 40.705], [-74 + index * 0.01, 40.705], [-74 + index * 0.01, 40.7]]] },
  properties: { h3: id, neighborhoodId: `Area ${index}`, borough: "Test", features: {
    venueDensity: 0.4 + index * 0.1, categoryDiversity: index % 2 ? 0.9 : 0.2, foodDensity: 0.4,
    drinkDensity: 0.2, coffeeDensity: 0.1, cultureDensity: 0.1, nightlifeDensity: index / 4,
    outdoorDensity: 0.1, wanderingScore: index % 2 ? 0.9 : 0.2, anchorConcentration: 0.4,
    venueCount: 3, evidenceConfidence: 1,
  } },
})) };

const venue = (id: string, area: string, h3: string, category: VenueRecord["category"], informal: number): VenueRecord => ({
  id, name: `Venue ${id}`, latitude: 40.702, longitude: -73.99, h3, neighborhoodId: area, category,
  qualityPrior: 0.65, qualityConfidence: 1, qualitySource: "engine_prior",
  featureScores: { informal, novel: 1 - informal, institution: informal, soloFriendly: 0.6, linger: 1 - informal, destination: informal, evidenceConfidence: 0.5 },
});
const venues = ["a", "b", "c", "d"].flatMap((h3, index) => [
  venue(`${h3}-food`, `Area ${index}`, h3, "restaurant", index % 2 ? 0.2 : 0.9),
  venue(`${h3}-coffee`, `Area ${index}`, h3, "cafe", 0.8),
  venue(`${h3}-bar`, `Area ${index}`, h3, "bar", 0.4),
]);

describe("personalization", () => {
  it("never changes the baseline by more than the configured cap", () => {
    const baseline = 0.6;
    const result = personalizeBaseline(baseline, profile(1, 1, 1), { energy: 1, novelty: 1, wandering: 1, formality: 1, neighborhoodOrientation: 1 }, 1);
    expect(Math.abs(result - baseline)).toBeLessThanOrEqual(baseline * PERSONALIZATION_CAP);
  });

  it("keeps zero-confidence areas at baseline", () => {
    const baseline = 0.6;
    expect(personalizeBaseline(baseline, profile(1, 1, 1), { energy: 1, novelty: 1, wandering: 1, formality: 1, neighborhoodOrientation: 1 }, 0)).toBe(baseline);
  });

  it("keeps explicit answers separate and dominant over early learned behavior", () => {
    const explicit = tasteProfileFromAnswers({ energy: -1, novelty: 1 }, true);
    const learned = learnTaste(explicit, { energy: 1, novelty: -1, wandering: 1, formality: 1, neighborhoodOrientation: 1 }, 0.5);
    expect(learned.dimensions?.energy.explicitValue).toBe(-1);
    expect(learned.dimensions?.energy.learnedConfidence).toBe(0.5);
    expect(learned.energy).toBeLessThan(-0.7);
  });
});

describe("street presentation", () => {
  it("collapses nearby parallel carriageway features into one centerline", () => {
    const shared = { strength: 0.8, confidence: 1, roadClass: "secondary", mergedCount: 1 };
    const result = mergeParallelStreetSegments([
      { ...shared, start: [-73.99, 40.72], end: [-73.989, 40.721] },
      { ...shared, start: [-73.99008, 40.72004], end: [-73.98908, 40.72104] },
      { ...shared, start: [-73.989, 40.721], end: [-73.988, 40.722] },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].mergedCount).toBe(2);
  });
});

describe("area and venue recommendations", () => {
  const run = (tasteProfile: TasteProfile | null, intent: "anything" | "coffee" = "anything") => buildAreaRecommendations({
    geometry, metrics: metric(55), venues, categoryCurves: null, hour: 15, intent,
    tasteProfile, mapMode: tasteProfile ? "personalized" : "baseline", userLocation: null,
  });

  it("returns every ranked area so a selected neighborhood can persist", () => expect(run(null)).toHaveLength(4));

  it("materially changes emphasis for opposite taste profiles", () => {
    const lively = run(profile(1, 1, 1));
    const quiet = run(profile(-1, -1, -1));
    expect(lively.map((area) => area.id)).not.toEqual(quiet.map((area) => area.id));
    expect(lively.every((area) => area.glowBasis === "taste")).toBe(true);
    expect(lively.map((area) => area.glowStrength)).not.toEqual(quiet.map((area) => area.glowStrength));
    const sharedArea = lively.find((area) => area.id === quiet[0].id);
    expect(sharedArea?.activeCells).toEqual(quiet[0].activeCells);
  });

  it("falls back to activity ordering and glow with fewer than two taste answers", () => {
    const baseline = run(null);
    const oneAnswer = run(tasteProfileFromAnswers({ energy: 1 }));
    expect(oneAnswer.map((area) => area.id)).toEqual(baseline.map((area) => area.id));
    expect(oneAnswer.map((area) => area.glowStrength)).toEqual(baseline.map((area) => area.glowStrength));
    expect(oneAnswer.every((area) => area.glowBasis === "activity")).toBe(true);
    expect(oneAnswer[0].recommendedVenues[0].recommendationLabel).toBe("Strong fit");
  });

  it("uses taste glow once two taste dimensions are answered", () => {
    const twoAnswers = run(tasteProfileFromAnswers({ energy: 1, novelty: 1 }));
    expect(twoAnswers.every((area) => area.glowBasis === "taste")).toBe(true);
    expect(twoAnswers[0].recommendedVenues[0].recommendationLabel).toBe("People like you");
  });

  it("changes activity fallback glow by time and dampens low-confidence areas", () => {
    const hourlyMetrics = metric(25);
    hourlyMetrics.records.a.activity = Array.from({ length: 24 }, (_, hour) => hour < 12 ? 100 : 5);
    hourlyMetrics.records.b.activity = Array.from({ length: 24 }, (_, hour) => hour < 12 ? 10 : 95);
    hourlyMetrics.records.a.confidence.activity = 10;
    hourlyMetrics.records.a.confidence.localOrientation = 10;
    hourlyMetrics.records.a.confidence.visitorPressure = 10;
    const buildAt = (hour: number) => buildAreaRecommendations({
      geometry, metrics: hourlyMetrics, venues, categoryCurves: null, hour, intent: "anything",
      tasteProfile: null, mapMode: "baseline", userLocation: null,
    });
    const morning = buildAt(6);
    const evening = buildAt(20);
    expect(morning.map((area) => area.glowStrength)).not.toEqual(evening.map((area) => area.glowStrength));
    const lowConfidenceGlow = morning.find((area) => area.id === "Area 0")!.glowStrength;
    const strongestSupportedGlow = Math.max(...morning.filter((area) => area.id !== "Area 0").map((area) => area.glowStrength));
    expect(lowConfidenceGlow).toBeLessThan(strongestSupportedGlow);
  });

  it("keeps venue recommendations inside the selected area and intent", () => {
    for (const area of run(null, "coffee")) {
      expect(area.mapVenues.every(({ venue: item }) => item.neighborhoodId === area.id && item.category === "cafe")).toBe(true);
    }
  });

  it("returns every eligible map place and emphasizes exactly five", () => {
    const denseVenues = [...venues, ...Array.from({ length: 300 }, (_, index) => venue(`dense-${index}`, "Area 0", "a", "restaurant", 0.5))];
    const result = buildAreaRecommendations({ geometry, metrics: metric(55), venues: denseVenues, categoryCurves: null, hour: 15, intent: "anything", tasteProfile: null, mapMode: "baseline", userLocation: null });
    const denseArea = result.find((area) => area.id === "Area 0");
    expect(denseArea?.mapVenues).toHaveLength(303);
    expect(denseArea?.recommendedVenues).toHaveLength(5);
    expect(denseArea?.mapVenues.filter((item) => item.isRecommended)).toHaveLength(5);
  });

  it("uses People like you only for a personalized map", () => {
    expect(run(null)[0].recommendedVenues[0].recommendationLabel).toBe("Strong fit");
    expect(run(profile(1, 1, 1))[0].recommendedVenues[0].recommendationLabel).toBe("People like you");
  });

  it("returns bounded five-dimensional radar evidence with honest sources", () => {
    const evidence = run(profile(1, 1, 1))[0].recommendedVenues[0].radarEvidence;
    expect(Object.values(evidence.values).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(Object.values(evidence.confidence).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(evidence.source.neighborhoodOrientation).toBe("area");
    expect(evidence.source.formality).toBe("category");
  });

  it("changes active-cell emphasis by time without letting low-confidence cells lead", () => {
    const neighborhoodGeometry: HexGeometryCollection = {
      ...geometry,
      features: geometry.features.map((feature, index) => ({
        ...feature,
        properties: {
          ...feature.properties,
          neighborhoodId: "Area",
          features: { ...feature.properties.features, evidenceConfidence: index === 0 ? 0.08 : 1 },
        },
      })),
    };
    const hourlyMetrics = metric(40);
    hourlyMetrics.records.a.activity = Array.from({ length: 24 }, (_, hour) => hour < 12 ? 95 : 10);
    hourlyMetrics.records.b.activity = Array.from({ length: 24 }, (_, hour) => hour < 12 ? 15 : 90);
    const neighborhoodVenues = venues.map((item) => ({ ...item, neighborhoodId: "Area" }));
    const buildAt = (hour: number) => buildAreaRecommendations({
      geometry: neighborhoodGeometry, metrics: hourlyMetrics, venues: neighborhoodVenues,
      categoryCurves: null, hour, intent: "anything", tasteProfile: null, mapMode: "baseline", userLocation: null,
    })[0];
    const morning = buildAt(6);
    const evening = buildAt(20);
    expect(morning.activeCells.map((cell) => cell.score)).not.toEqual(evening.activeCells.map((cell) => cell.score));
    const meanStrength = (area: typeof morning) => area.activeCells.reduce((sum, cell) => sum + cell.score, 0) / area.activeCells.length;
    expect(Math.abs(meanStrength(morning) - meanStrength(evening))).toBeGreaterThan(0.02);
    expect(morning.activeCells.find((cell) => cell.h3 === "a")?.score).toBeLessThan(Math.max(...morning.activeCells.filter((cell) => cell.h3 !== "a").map((cell) => cell.score)));
  });

  it("never exposes local or visitor modeling in public explanations", () => {
    const copy = run(profile(1, 1, 1)).flatMap((area) => [...area.contributions, ...area.mapVenues.flatMap((item) => item.contributions)]).map((item) => item.label).join(" ");
    expect(copy).not.toMatch(/local|tourist|visitor/i);
  });
});
