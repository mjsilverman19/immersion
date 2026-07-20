import { describe, expect, it } from "vitest";

import { personalizeBaselineVector, tasteContributionsVector, tasteLens } from "@/lib/personalization";
import { decodeTasteSpace, venueVector } from "@/lib/tasteSpace";
import { tasteProfileFromAnswers } from "@/lib/tasteProfile";
import {
  effectiveDirection,
  learnTasteVector,
  migrateProfileToV3,
  profileFromAnswers,
} from "@/lib/tasteVector";
import type { TasteSpaceArtifact } from "@/types/data";

import fixture from "./tasteSpace.fixture.json";

const space = decodeTasteSpace(fixture as unknown as TasteSpaceArtifact, 4);

describe("profileFromAnswers", () => {
  it("projects a lone anchor answer to ±viewGain on its dimension", () => {
    const profile = profileFromAnswers({ q_energy: 1 }, space);
    expect(profile.version).toBe(3);
    expect(profile.energy).toBeCloseTo(0.8, 5);
    expect(profile.novelty).toBe(0);
    // The wandering interpretive axis shares a 0.48 component with energy.
    expect(profile.wandering).toBeCloseTo(0.8 * 0.48, 5);
    expect(profile.vector).toEqual([1, 0, 0]);
  });

  it("weights answers: real answers 1, 'both' 0.5, toward the 6-unit target", () => {
    expect(profileFromAnswers({ q_energy: 1 }, space).confidence).toBeCloseTo(1 / 6, 5);
    expect(profileFromAnswers({ q_energy: 1, q_novelty: 0 }, space).confidence).toBeCloseTo(1.5 / 6, 5);
  });

  it("stamps quizCompletedAt only when completed", () => {
    expect(profileFromAnswers({ q_energy: 1 }, space).quizCompletedAt).toBeUndefined();
    expect(profileFromAnswers({ q_energy: 1 }, space, true).quizCompletedAt).toBeTypeOf("string");
  });
});

describe("learnTasteVector", () => {
  it("crossfades explicit and learned with the 4/(4+confidence) schedule", () => {
    const start = profileFromAnswers({ q_energy: 1 }, space, true);
    // 4 evidence units toward venue v1 = [0,3,0] -> equal blend of the two
    // unit directions.
    const learned = learnTasteVector(start, venueVector(space, 1), 4, space);
    const direction = effectiveDirection(learned)!;
    expect(direction[0]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(direction[1]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(learned.energy).toBeCloseTo(0.8 * Math.SQRT1_2, 3);
    expect(learned.novelty).toBeCloseTo(0.8 * Math.SQRT1_2, 3);
    // The interpretable record tracks both components.
    expect(learned.dimensions!.energy.explicitValue).toBeCloseTo(0.8, 5);
    expect(learned.dimensions!.energy.learnedConfidence).toBe(4);
  });

  it("accumulates evidence as a running mean", () => {
    const start = profileFromAnswers({ q_energy: 1 }, space, true);
    const once = learnTasteVector(start, venueVector(space, 1), 2, space);
    const twice = learnTasteVector(once, venueVector(space, 1), 2, space);
    expect(twice.learnedVectorConfidence).toBe(4);
    expect(twice.learnedVector![1]).toBeCloseTo(1, 3);
  });

  it("leaves legacy profiles untouched", () => {
    const legacy = tasteProfileFromAnswers({ energy: 1 });
    expect(learnTasteVector(legacy, venueVector(space, 1), 2, space)).toBe(legacy);
  });
});

describe("migrateProfileToV3", () => {
  it("returns null for an already-current profile", () => {
    const current = profileFromAnswers({ q_energy: 1 }, space, true);
    expect(migrateProfileToV3(current, space)).toBeNull();
  });

  it("maps v2 explicit values onto the anchor questions and preserves behavior direction", () => {
    const v2 = tasteProfileFromAnswers({ energy: 1, novelty: -1 }, true);
    const migrated = migrateProfileToV3(v2, space)!;
    expect(migrated.version).toBe(3);
    expect(migrated.answers).toEqual({ q_energy: 1, q_novelty: -1 });
    expect(migrated.vector).toEqual([1, -1, 0]);
    // Old confidence (answered/5) is preserved so an active personalized map
    // stays above the 0.4 gate through migration.
    expect(migrated.confidence).toBe(v2.confidence);
    // The migrated direction ranks an energy-aligned venue up and a
    // novelty-aligned venue down, matching the v2 profile's intent.
    const lens = tasteLens(migrated, space)!;
    const energyVenue = personalizeBaselineVector(100, lens, venueVector(space, 0), 1);
    const noveltyVenue = personalizeBaselineVector(100, lens, venueVector(space, 1), 1);
    expect(energyVenue).toBeGreaterThan(100);
    expect(noveltyVenue).toBeLessThan(100);
  });

  it("carries v2 learned evidence into the learned vector", () => {
    let v2 = tasteProfileFromAnswers({ energy: 1 }, true);
    v2 = {
      ...v2,
      dimensions: {
        ...v2.dimensions!,
        novelty: { explicitValue: null, learnedValue: 1, learnedConfidence: 3, effectiveValue: 0.43 },
      },
    };
    const migrated = migrateProfileToV3(v2, space)!;
    expect(migrated.learnedVector).toBeDefined();
    expect(migrated.learnedVector![1]).toBeGreaterThan(0);
    expect(migrated.learnedVectorConfidence).toBe(3);
  });

  it("recomputes a v3 profile from answers when the question bank changes", () => {
    const stale = {
      ...profileFromAnswers({ q_energy: 1 }, space, true),
      bankVersion: 0,
      answers: { q_energy: 1 as const, q_removed: 1 as const },
      vector: [9, 9, 9],
    };
    const migrated = migrateProfileToV3(stale, space)!;
    expect(migrated.answers).toEqual({ q_energy: 1 });
    expect(migrated.vector).toEqual([1, 0, 0]);
    expect(migrated.confidence).toBeCloseTo(1 / 6, 5);
  });
});

describe("personalizeBaselineVector", () => {
  const profile = profileFromAnswers({ q_energy: 1, q_novelty: 1, q_formality: 1, q_wandering: 1, q_neighborhood: 1, q_extra: 1 }, space, true);
  const lens = tasteLens(profile, space)!;

  it("never exceeds the cap and respects evidence confidence", () => {
    const aligned = venueVector(space, 0);
    const full = personalizeBaselineVector(100, lens, aligned, 1, 0.3);
    expect(full).toBeGreaterThan(100);
    expect(full).toBeLessThanOrEqual(130);
    const halfEvidence = personalizeBaselineVector(100, lens, aligned, 0.5, 0.3);
    expect(halfEvidence - 100).toBeCloseTo((full - 100) / 2, 5);
    expect(personalizeBaselineVector(100, null, aligned, 1)).toBe(100);
    expect(personalizeBaselineVector(100, lens, undefined, 1)).toBe(100);
  });

  it("derives explanation chips from channel dots with stable copy", () => {
    const energyProfile = profileFromAnswers({ q_energy: 1 }, space, true);
    const energyLens = tasteLens(energyProfile, space)!;
    const chips = tasteContributionsVector(energyLens, venueVector(space, 0), 0.9);
    expect(chips).toHaveLength(1);
    expect(chips[0].feature).toBe("taste:temporal");
    expect(chips[0].label).toBe("Its weekly rhythm matches yours");
    expect(chips[0].evidenceConfidence).toBe(0.9);
    // A venue orthogonal to the direction earns no taste chips.
    expect(tasteContributionsVector(energyLens, venueVector(space, 1), 0.9)).toHaveLength(0);
  });
});
