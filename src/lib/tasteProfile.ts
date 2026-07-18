import type { TasteDimension, TasteDimensionKey, TasteProfile } from "@/types/data";

export const TASTE_DIMENSIONS: TasteDimensionKey[] = ["energy", "novelty", "wandering", "formality", "neighborhoodOrientation"];

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

function effectiveValue(dimension: TasteDimension): number {
  if (dimension.explicitValue === null) return clamp(dimension.learnedValue);
  const explicitWeight = 4 / (4 + dimension.learnedConfidence);
  return clamp(explicitWeight * dimension.explicitValue + (1 - explicitWeight) * dimension.learnedValue);
}

export function tasteProfileFromAnswers(answers: Partial<Record<TasteDimensionKey, number>>, completed = false): TasteProfile {
  const dimensions = Object.fromEntries(TASTE_DIMENSIONS.map((key) => {
    const explicitValue = answers[key] ?? null;
    const dimension: TasteDimension = { explicitValue, learnedValue: 0, learnedConfidence: 0, effectiveValue: explicitValue ?? 0 };
    return [key, dimension];
  })) as Record<TasteDimensionKey, TasteDimension>;
  const now = new Date().toISOString();
  return {
    energy: dimensions.energy.effectiveValue,
    novelty: dimensions.novelty.effectiveValue,
    wandering: dimensions.wandering.effectiveValue,
    formality: dimensions.formality.effectiveValue,
    neighborhoodOrientation: dimensions.neighborhoodOrientation.effectiveValue,
    confidence: Object.keys(answers).length / TASTE_DIMENSIONS.length,
    version: 2,
    dimensions,
    ...(completed ? { quizCompletedAt: now } : {}),
    updatedAt: now,
  };
}

export function learnTaste(profile: TasteProfile, signals: Record<TasteDimensionKey, number>, evidenceUnits: number): TasteProfile {
  const dimensions = profile.dimensions ?? tasteProfileFromAnswers(Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, profile[key]]))).dimensions!;
  const nextDimensions = Object.fromEntries(TASTE_DIMENSIONS.map((key) => {
    const current = dimensions[key];
    const total = current.learnedConfidence + evidenceUnits;
    const learnedValue = total > 0 ? (current.learnedValue * current.learnedConfidence + clamp(signals[key]) * evidenceUnits) / total : current.learnedValue;
    const next: TasteDimension = { ...current, learnedValue, learnedConfidence: total, effectiveValue: 0 };
    next.effectiveValue = effectiveValue(next);
    return [key, next];
  })) as Record<TasteDimensionKey, TasteDimension>;
  return {
    ...profile,
    ...Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, nextDimensions[key].effectiveValue])),
    dimensions: nextDimensions,
    updatedAt: new Date().toISOString(),
  };
}
