/**
 * Vector-space taste profile math (profile version 3).
 *
 * The profile's source of truth is `answers` (questionId -> -1|0|1); the
 * explicit taste direction is the sum of answer-signed question axes in the
 * shipped taste space. Behavioural evidence accumulates in a separate learned
 * direction and crossfades in with the same 4/(4+confidence) schedule the
 * legacy per-dimension model used. The five named dimensions remain populated
 * as an interpretable projection (via the anchor-question axes) so every
 * existing surface — radar, traits, retrieval lens, confidence gate — keeps
 * reading the profile unchanged.
 */
import { dot, norm, normalize } from "@/lib/tasteSpace";
import { TASTE_DIMENSIONS } from "@/lib/tasteProfile";
import type {
  TasteAnswer,
  TasteDimension,
  TasteDimensionKey,
  TasteProfile,
  TasteSpace,
} from "@/types/data";

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** Real answers count 1, "both" counts 0.5; confidence saturates at 6 units. */
const CONFIDENCE_TARGET = 6;
/** Same crossfade constant as the legacy per-dimension model. */
const EXPLICIT_PRIOR_UNITS = 4;

export function answerWeight(answers: Record<string, TasteAnswer>): number {
  return Object.values(answers).reduce<number>((sum, answer) => sum + (answer === 0 ? 0.5 : 1), 0);
}

function questionById(space: TasteSpace, id: string) {
  return space.questions.find((question) => question.id === id);
}

export function explicitVectorFromAnswers(answers: Record<string, TasteAnswer>, space: TasteSpace): Float32Array {
  const vector = new Float32Array(space.dims);
  for (const [id, answer] of Object.entries(answers)) {
    if (answer === 0) continue;
    const question = questionById(space, id);
    if (!question) continue;
    for (let i = 0; i < space.dims; i += 1) vector[i] += answer * question.axis[i];
  }
  return vector;
}

/** Interpretable 5-dim view of a direction: clamp(viewGain · ⟨û, d_k⟩). */
export function interpretableView(direction: ArrayLike<number>, space: TasteSpace): Record<TasteDimensionKey, number> {
  const unit = normalize(direction);
  return Object.fromEntries(TASTE_DIMENSIONS.map((key) => [
    key,
    clamp(space.viewGain * dot(unit, space.interpretiveAxes[key])),
  ])) as Record<TasteDimensionKey, number>;
}

/** The unit direction taste matching uses: explicit crossfaded with learned. */
export function effectiveDirection(profile: TasteProfile): Float32Array | null {
  if (!profile.vector) return null;
  const explicit = normalize(profile.vector);
  const learnedConfidence = profile.learnedVectorConfidence ?? 0;
  if (!profile.learnedVector || learnedConfidence <= 0) {
    return norm(explicit) > 0 ? explicit : null;
  }
  const learned = normalize(profile.learnedVector);
  const explicitWeight = EXPLICIT_PRIOR_UNITS / (EXPLICIT_PRIOR_UNITS + learnedConfidence);
  const blended = new Float32Array(explicit.length);
  for (let i = 0; i < blended.length; i += 1) {
    blended[i] = explicitWeight * explicit[i] + (1 - explicitWeight) * learned[i];
  }
  const unit = normalize(blended);
  return norm(unit) > 0 ? unit : null;
}

function dimensionsRecord(
  view: Record<TasteDimensionKey, number>,
  learnedView: Record<TasteDimensionKey, number> | null,
  learnedConfidence: number,
  effectiveView: Record<TasteDimensionKey, number>,
): Record<TasteDimensionKey, TasteDimension> {
  return Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, {
    explicitValue: view[key],
    learnedValue: learnedView ? learnedView[key] : 0,
    learnedConfidence,
    effectiveValue: effectiveView[key],
  }])) as Record<TasteDimensionKey, TasteDimension>;
}

function assembleProfile(
  answers: Record<string, TasteAnswer>,
  explicit: Float32Array,
  learnedVector: number[] | undefined,
  learnedConfidence: number,
  confidence: number,
  space: TasteSpace,
  extra: Partial<TasteProfile>,
): TasteProfile {
  const draft: TasteProfile = {
    energy: 0, novelty: 0, wandering: 0, formality: 0, neighborhoodOrientation: 0,
    confidence,
    version: 3,
    spaceVersion: space.version,
    bankVersion: space.bankVersion,
    answers,
    vector: Array.from(explicit, (value) => Number(value.toFixed(5))),
    ...(learnedVector ? { learnedVector, learnedVectorConfidence: learnedConfidence } : {}),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  const effective = effectiveDirection(draft);
  const explicitView = interpretableView(explicit, space);
  const learnedView = learnedVector ? interpretableView(learnedVector, space) : null;
  const effectiveView = effective ? interpretableView(effective, space) : explicitView;
  draft.dimensions = dimensionsRecord(explicitView, learnedView, learnedConfidence, effectiveView);
  for (const key of TASTE_DIMENSIONS) draft[key] = effectiveView[key];
  return draft;
}

export function profileFromAnswers(
  answers: Record<string, TasteAnswer>,
  space: TasteSpace,
  completed = false,
): TasteProfile {
  const explicit = explicitVectorFromAnswers(answers, space);
  const confidence = Math.min(1, answerWeight(answers) / CONFIDENCE_TARGET);
  return assembleProfile(answers, explicit, undefined, 0, confidence, space, {
    ...(completed ? { quizCompletedAt: new Date().toISOString() } : {}),
  });
}

/** Vector-space analogue of learnTaste: running-mean update of the learned
 * direction, then re-derive the interpretable view from the new blend. */
export function learnTasteVector(
  profile: TasteProfile,
  venueVec: ArrayLike<number>,
  evidenceUnits: number,
  space: TasteSpace,
): TasteProfile {
  if (!profile.vector || !profile.answers) return profile;
  const unit = normalize(venueVec);
  if (norm(unit) === 0) return profile;
  const previousConfidence = profile.learnedVectorConfidence ?? 0;
  const total = previousConfidence + evidenceUnits;
  const learned = new Float32Array(space.dims);
  for (let i = 0; i < space.dims; i += 1) {
    const previous = profile.learnedVector?.[i] ?? 0;
    learned[i] = total > 0 ? (previous * previousConfidence + unit[i] * evidenceUnits) / total : previous;
  }
  return assembleProfile(
    profile.answers,
    Float32Array.from(profile.vector),
    Array.from(learned, (value) => Number(value.toFixed(5))),
    total,
    profile.confidence,
    space,
    { quizCompletedAt: profile.quizCompletedAt },
  );
}

const roundAnswer = (value: number): TasteAnswer => (value > 0.5 ? 1 : value < -0.5 ? -1 : 0);

/**
 * Upgrade a stored profile to v3 against the loaded taste space. Returns the
 * migrated profile, or null when the profile is already current. v2 explicit
 * values map onto the anchor questions (they are exactly the old ±1/0 quiz
 * answers); learned per-dimension values become a learned direction along the
 * interpretive axes. A v3 profile from a stale bank/space recomputes from its
 * stored answers, dropping answers to removed questions.
 */
export function migrateProfileToV3(profile: TasteProfile, space: TasteSpace): TasteProfile | null {
  if (profile.version >= 3 && profile.spaceVersion === space.version && profile.bankVersion === space.bankVersion) {
    return null;
  }
  if (profile.version >= 3 && profile.answers) {
    const kept = Object.fromEntries(
      Object.entries(profile.answers).filter(([id]) => questionById(space, id)),
    ) as Record<string, TasteAnswer>;
    const explicit = explicitVectorFromAnswers(kept, space);
    const learnedValid = profile.learnedVector?.length === space.dims;
    return assembleProfile(
      kept,
      explicit,
      learnedValid ? profile.learnedVector : undefined,
      learnedValid ? profile.learnedVectorConfidence ?? 0 : 0,
      Math.min(1, answerWeight(kept) / CONFIDENCE_TARGET),
      space,
      { quizCompletedAt: profile.quizCompletedAt },
    );
  }
  // v2 (or older): reconstruct answers onto the anchor questions.
  const dimensions = profile.dimensions;
  const answers: Record<string, TasteAnswer> = {};
  const learned = new Float32Array(space.dims);
  let learnedConfidenceTotal = 0;
  let learnedDimensions = 0;
  for (const question of space.questions) {
    if (!question.anchor || !question.dimension) continue;
    const dimension = dimensions?.[question.dimension];
    const explicitValue = dimension ? dimension.explicitValue : profile[question.dimension];
    if (explicitValue !== null && explicitValue !== undefined) {
      answers[question.id] = roundAnswer(explicitValue * question.sign);
    }
    const learnedValue = dimension?.learnedValue ?? 0;
    const learnedConfidence = dimension?.learnedConfidence ?? 0;
    if (learnedConfidence > 0) {
      const axis = space.interpretiveAxes[question.dimension];
      for (let i = 0; i < space.dims; i += 1) learned[i] += learnedValue * axis[i];
      learnedConfidenceTotal += learnedConfidence;
      learnedDimensions += 1;
    }
  }
  const explicit = explicitVectorFromAnswers(answers, space);
  const hasLearned = learnedDimensions > 0 && norm(learned) > 0;
  return assembleProfile(
    answers,
    explicit,
    hasLearned ? Array.from(learned, (value) => Number(value.toFixed(5))) : undefined,
    hasLearned ? learnedConfidenceTotal / learnedDimensions : 0,
    // Preserve the stored confidence: the old scale (answered/5) cleared the
    // 0.4 personalization gate with two answers, and migration must not
    // silently de-personalize an active map.
    profile.confidence,
    space,
    { quizCompletedAt: profile.quizCompletedAt },
  );
}
