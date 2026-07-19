import { describe, expect, it } from "vitest";

import { evidenceConfidenceLabel, fitDimensionRows, tasteRadarProfile } from "@/components/taste/TasteRadar";
import { googleMapsPlaceUrl } from "@/lib/placeLinks";
import { migratePlaceStates } from "@/lib/storage";
import type { RadarEvidence, TasteProfile } from "@/types/data";

const evidence = (confidence: number): RadarEvidence => ({
  values: { energy: 0.8, novelty: 0.2, wandering: 0.6, formality: 0.4, neighborhoodOrientation: 0.9 },
  confidence: { energy: confidence, novelty: confidence, wandering: confidence, formality: confidence, neighborhoodOrientation: confidence },
  source: { energy: "venue", novelty: "category", wandering: "area", formality: "venue", neighborhoodOrientation: "area" },
});

const taste: TasteProfile = {
  energy: 1,
  novelty: -1,
  wandering: 0.5,
  formality: 0,
  neighborhoodOrientation: -0.5,
  confidence: 1,
  version: 2,
};

describe("Google Maps place links", () => {
  it("opens a place search rather than directions", () => {
    const result = googleMapsPlaceUrl({ name: "Tiki Chick", latitude: 40.786837, longitude: -73.9754 });
    const url = new URL(result);
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Tiki Chick 40.786837,-73.9754");
    expect(result).not.toContain("/maps/dir/");
  });

  it("encodes punctuation and non-ASCII place names", () => {
    const result = googleMapsPlaceUrl({ name: "Café L’Allée & Bar", latitude: 40.7, longitude: -74 });
    expect(new URL(result).searchParams.get("query")).toBe("Café L’Allée & Bar 40.7,-74");
  });
});

describe("place interaction migration", () => {
  it("moves legacy directions counts to map views without losing place state", () => {
    const result = migratePlaceStates({
      tiki: { venueId: "tiki", saved: true, visited: false, endorsed: true, directionsRequested: 3, note: "Fun", updatedAt: "now" },
    });
    expect(result.tiki).toMatchObject({ saved: true, endorsed: true, note: "Fun", mapViews: 3 });
    expect(result.tiki).not.toHaveProperty("directionsRequested");
  });

  it("does not overwrite a current map view count", () => {
    const result = migratePlaceStates({
      tiki: { venueId: "tiki", saved: false, visited: false, endorsed: false, directionsRequested: 3, mapViews: 5, updatedAt: "now" },
    });
    expect(result.tiki.mapViews).toBe(5);
  });
});

describe("fit visualization", () => {
  it("normalizes taste values and builds paired dimension rows", () => {
    expect(tasteRadarProfile(taste)).toMatchObject({ energy: 1, novelty: 0, wandering: 0.75, formality: 0.5, neighborhoodOrientation: 0.25 });
    const rows = fitDimensionRows(taste, evidence(0.6));
    expect(rows).toHaveLength(5);
    expect(rows.find((row) => row.key === "energy")).toMatchObject({ low: "Quiet", high: "Lively", tasteValue: 1, placeValue: 0.8, confidence: 0.6 });
  });

  it("omits taste markers when no profile exists and labels evidence confidence", () => {
    expect(fitDimensionRows(null, evidence(0.2)).every((row) => row.tasteValue === null)).toBe(true);
    expect(evidenceConfidenceLabel(evidence(0.2))).toBe("Limited evidence");
    expect(evidenceConfidenceLabel(evidence(0.5))).toBe("Some evidence");
    expect(evidenceConfidenceLabel(evidence(0.8))).toBe("Strong evidence");
  });
});
