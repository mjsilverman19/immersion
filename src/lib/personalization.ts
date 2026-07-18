import type { ScoreContribution, TasteProfile } from "@/types/data";

export const PERSONALIZATION_CAP = 0.3;

export interface TasteSignals {
  energy: number;
  novelty: number;
  wandering: number;
  formality: number;
  neighborhoodOrientation: number;
}

export function tasteDot(profile: TasteProfile, signals: TasteSignals): number {
  const terms = [
    profile.energy * signals.energy,
    profile.novelty * signals.novelty,
    profile.wandering * signals.wandering,
    profile.formality * signals.formality,
    profile.neighborhoodOrientation * signals.neighborhoodOrientation,
  ];
  return terms.reduce((sum, value) => sum + value, 0) / terms.length;
}

export function personalizeBaseline(
  baseline: number,
  profile: TasteProfile | null,
  signals: TasteSignals,
  confidence: number,
): number {
  if (!profile) return baseline;
  // The profile is intentionally bounded, but the response needs to be strong
  // enough to produce a visible reorder. Confidence from skipped questions
  // scales the effect down without changing the 30% ceiling.
  const match = Math.tanh(2.4 * tasteDot(profile, signals)) * profile.confidence;
  const raw = baseline * (1 + PERSONALIZATION_CAP * match);
  return baseline + Math.max(0, Math.min(1, confidence)) * (raw - baseline);
}

export function tasteContributions(
  profile: TasteProfile | null,
  signals: TasteSignals,
  confidence: number,
): ScoreContribution[] {
  if (!profile) return [];
  const terms = [
    { feature: "energy", value: profile.energy * signals.energy, positive: "The energy level matches your map" },
    { feature: "novelty", value: profile.novelty * signals.novelty, positive: "The mix offers the kind of discovery you chose" },
    { feature: "wandering", value: profile.wandering * signals.wandering, positive: "Several places are close enough to wander between" },
    { feature: "formality", value: profile.formality * signals.formality, positive: "The planning style fits your preferences" },
  ];
  return terms
    .filter((term) => term.value > 0.08)
    .map((term) => ({ feature: term.feature, contribution: term.value, label: term.positive, evidenceConfidence: confidence }))
    .sort((a, b) => b.contribution - a.contribution);
}
