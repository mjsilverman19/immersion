import { channelDots, dot } from "@/lib/tasteSpace";
import { effectiveDirection } from "@/lib/tasteVector";
import type { ScoreContribution, TasteChannelKey, TasteProfile, TasteSpace } from "@/types/data";

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

/** Shared bounded-nudge shape: baseline scaled by the capped match, lerped by
 * the evidence confidence so thin-evidence rows barely move. */
function applyMatch(baseline: number, match: number, confidence: number, cap: number): number {
  const raw = baseline * (1 + cap * match);
  return baseline + Math.max(0, Math.min(1, confidence)) * (raw - baseline);
}

export function personalizeBaseline(
  baseline: number,
  profile: TasteProfile | null,
  signals: TasteSignals,
  confidence: number,
  cap: number = PERSONALIZATION_CAP,
): number {
  if (!profile) return baseline;
  // The profile is intentionally bounded, but the response needs to be strong
  // enough to produce a visible reorder. Confidence from skipped questions
  // scales the effect down without changing the ceiling. `cap` sets that
  // ceiling: areas keep the ±30% default; venues pass a tighter ±15% so taste
  // nudges the contextual ranking without overturning quality-in-context.
  const match = Math.tanh(2.4 * tasteDot(profile, signals)) * profile.confidence;
  return applyMatch(baseline, match, confidence, cap);
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

// --- Vector taste space (profile v3 + taste_space.json) ---------------------

/** Everything the per-row scoring loop needs, computed once per ranking pass. */
export interface TasteLens {
  direction: Float32Array;
  gain: number;
  channels: TasteSpace["channels"];
  profileConfidence: number;
  /** The user's interpretable novelty leaning, for sign-aware role copy. */
  noveltyView: number;
}

export function tasteLens(profile: TasteProfile | null, space: TasteSpace | null): TasteLens | null {
  if (!profile || !space) return null;
  const direction = effectiveDirection(profile);
  if (!direction) return null;
  return {
    direction,
    gain: space.matchGain,
    channels: space.channels,
    profileConfidence: profile.confidence,
    noveltyView: profile.novelty,
  };
}

/** Vector analogue of personalizeBaseline: same tanh bounding, caps, and
 * confidence-lerp; only the inner product source changes. `matchGain` is
 * calibrated offline so the nudge spread matches the legacy hand-signal model. */
export function personalizeBaselineVector(
  baseline: number,
  lens: TasteLens | null,
  vector: ArrayLike<number> | undefined,
  confidence: number,
  cap: number = PERSONALIZATION_CAP,
): number {
  if (!lens || !vector) return baseline;
  const match = Math.tanh(lens.gain * dot(lens.direction, vector)) * lens.profileConfidence;
  return applyMatch(baseline, match, confidence, cap);
}

const CHANNEL_CONTRIBUTION_THRESHOLD = 0.08;

const CHANNEL_LABELS: Record<Exclude<TasteChannelKey, "role">, string> = {
  temporal: "Its weekly rhythm matches yours",
  ecology: "Surrounded by the kind of streets you chose",
  area: "The neighborhood character fits your map",
  spend: "The price register fits your plans",
};

/** Explanation chips from per-channel dot products between the user's taste
 * direction and the row's vector. Channels carry semantic meaning (see
 * pipeline/build_place_fingerprints.py), so each maps to stable copy. */
export function tasteContributionsVector(
  lens: TasteLens | null,
  vector: ArrayLike<number> | undefined,
  confidence: number,
): ScoreContribution[] {
  if (!lens || !vector) return [];
  const dots = channelDots(lens.direction, vector, lens.channels);
  return (Object.entries(dots) as [TasteChannelKey, number][])
    .filter(([, value]) => value > CHANNEL_CONTRIBUTION_THRESHOLD)
    .map(([channel, value]) => ({
      feature: `taste:${channel}`,
      contribution: value * lens.profileConfidence,
      label: channel === "role"
        ? lens.noveltyView >= 0 ? "The kind of find you look for" : "The kind of anchor you look for"
        : CHANNEL_LABELS[channel],
      evidenceConfidence: confidence,
    }))
    .sort((a, b) => b.contribution - a.contribution);
}
