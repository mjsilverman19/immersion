/**
 * Adaptive question selection for the taste quiz.
 *
 * Greedy information gain over the shipped corpus statistics: at each step the
 * answered questions' axes span a resolved subspace; each remaining question is
 * scored by the corpus standard deviation of venue projections along the
 * component of its axis NOT already in that subspace — sqrt(rᵀ Σ r) for the
 * Gram–Schmidt residual r. That is exactly "how much could this answer still
 * reorder the visible ranking, beyond what we already know." Questions that
 * cannot discriminate the current intent's categories (tiny per-category sigma)
 * are dropped for that session. Deterministic given prior answers, so Back
 * replays history consistently. Pure functions — no React.
 */
import { covarianceQuadraticForm, dot, norm, normalize } from "@/lib/tasteSpace";
import type { Intent, TasteAnswer, TasteQuestion, TasteSpace, VenueRecord } from "@/types/data";

export interface AskedQuestion {
  questionId: string;
  /** -1 | 0 | 1, or undefined for a skipped question. */
  answer: TasteAnswer | undefined;
}

export const MIN_QUESTIONS = 6;
export const MAX_QUESTIONS = 8;
/** Stop early once the best remaining gain falls below this fraction of the
 * strongest opening question's gain. */
const STOP_GAIN_FRACTION = 0.35;
/** Intent-aware drop: a question whose projection spread within every category
 * of the current intent is below this fraction of the median question sigma
 * cannot reorder the visible corpus. */
const INTENT_SIGMA_FRACTION = 0.25;
/** Relevance tilt: pure residual-variance selection is independent of the
 * answers' VALUES (a linear-Gaussian property), which would give every no-skip
 * user the identical sequence. This mild up-weight for questions whose axis
 * points where the user's answers are heading makes selection branch on signs —
 * probing finer distinctions inside the revealed taste region — while the
 * variance term keeps overall coverage. */
const RELEVANCE_TILT = 0.35;

// Kept in sync with INTENT_CATEGORIES in recommendations.ts (not imported to
// keep this module dependency-free of the ranking layer).
const INTENT_CATEGORIES: Record<Intent, VenueRecord["category"][]> = {
  anything: ["restaurant", "bar", "cafe", "museum", "park", "nightlife"],
  eat: ["restaurant"],
  drink: ["bar"],
  coffee: ["cafe"],
  culture: ["museum"],
  outside: ["park"],
  nightlife: ["nightlife", "bar"],
};

function medianSigma(space: TasteSpace): number {
  const sigmas = space.questions.map((question) => question.sigma).sort((a, b) => a - b);
  if (!sigmas.length) return 0;
  const mid = Math.floor(sigmas.length / 2);
  return sigmas.length % 2 ? sigmas[mid] : (sigmas[mid - 1] + sigmas[mid]) / 2;
}

/** Questions that can still discriminate the venues this intent surfaces. */
function eligibleForIntent(space: TasteSpace, intent: Intent): TasteQuestion[] {
  const categories = INTENT_CATEGORIES[intent];
  const threshold = INTENT_SIGMA_FRACTION * medianSigma(space);
  return space.questions.filter((question) =>
    categories.some((category) => (question.sigmaByCategory[category] ?? 0) >= threshold),
  );
}

/** Orthonormal basis of the answered questions' axes. "Both" answers count —
 * declared indifference resolves that direction just as a pick does — while
 * skips resolve nothing. */
function answeredBasis(space: TasteSpace, asked: AskedQuestion[]): Float64Array[] {
  const basis: Float64Array[] = [];
  for (const item of asked) {
    if (item.answer === undefined) continue;
    const question = space.questions.find((candidate) => candidate.id === item.questionId);
    if (!question) continue;
    // Float64 keeps the Gram–Schmidt arithmetic exact enough that selection
    // order never depends on rounding noise.
    const residual = Float64Array.from(question.axis);
    for (const axis of basis) {
      const projection = dot(residual, axis);
      for (let i = 0; i < residual.length; i += 1) residual[i] -= projection * axis[i];
    }
    const length = norm(residual);
    if (length > 1e-6) {
      for (let i = 0; i < residual.length; i += 1) residual[i] /= length;
      basis.push(residual);
    }
  }
  return basis;
}

/** sqrt(rᵀ Σ r) for the question axis' component outside the resolved subspace. */
export function questionGain(space: TasteSpace, question: TasteQuestion, basis: ArrayLike<number>[]): number {
  const residual = Float64Array.from(question.axis);
  for (const axis of basis) {
    const projection = dot(residual, axis);
    for (let i = 0; i < residual.length; i += 1) residual[i] -= projection * axis[i];
  }
  const variance = covarianceQuadraticForm(space.covariance, residual, space.dims);
  return Math.sqrt(Math.max(0, variance));
}

/** The user's current explicit direction (unit), or null before any ±1 answer. */
function answeredDirection(space: TasteSpace, asked: AskedQuestion[]): Float32Array | null {
  const direction = new Float64Array(space.dims);
  let any = false;
  for (const item of asked) {
    if (!item.answer) continue;
    const question = space.questions.find((candidate) => candidate.id === item.questionId);
    if (!question) continue;
    for (let i = 0; i < space.dims; i += 1) direction[i] += item.answer * question.axis[i];
    any = true;
  }
  if (!any) return null;
  const unit = normalize(direction);
  return norm(unit) > 0 ? unit : null;
}

function relevanceTilt(question: TasteQuestion, direction: Float32Array | null): number {
  if (!direction) return 1;
  const cosine = dot(normalize(question.axis), direction);
  return 1 + RELEVANCE_TILT * Math.max(0, cosine);
}

function bestRemaining(
  space: TasteSpace,
  asked: AskedQuestion[],
  intent: Intent,
): { question: TasteQuestion; maxGain: number } | null {
  const askedIds = new Set(asked.map((item) => item.questionId));
  const basis = answeredBasis(space, asked);
  const direction = answeredDirection(space, asked);
  let best: { question: TasteQuestion; score: number } | null = null;
  let maxGain = 0;
  for (const question of eligibleForIntent(space, intent)) {
    if (askedIds.has(question.id)) continue;
    const gain = questionGain(space, question, basis);
    maxGain = Math.max(maxGain, gain);
    const score = gain * relevanceTilt(question, direction);
    // Strictly-greater comparison in stable bank order keeps selection
    // deterministic, so Back/forward replays identically.
    if (!best || score > best.score) best = { question, score };
  }
  return best ? { question: best.question, maxGain } : null;
}

/** The unconditional gain of the strongest opening question — the reference
 * the stop rule is measured against. */
function openingGain(space: TasteSpace, intent: Intent): number {
  let best = 0;
  for (const question of eligibleForIntent(space, intent)) {
    best = Math.max(best, questionGain(space, question, []));
  }
  return best;
}

/**
 * The next question to ask, or null when the quiz should stop: at least
 * MIN_QUESTIONS asked and the best remaining gain has decayed below the stop
 * fraction, or MAX_QUESTIONS reached, or the bank is exhausted.
 */
export function nextQuestion(space: TasteSpace, asked: AskedQuestion[], intent: Intent): TasteQuestion | null {
  if (asked.length >= MAX_QUESTIONS) return null;
  const best = bestRemaining(space, asked, intent);
  if (!best) return null;
  // The stop rule watches the untilted gain: once no remaining question can
  // meaningfully reorder the corpus, relevance alone is not worth a question.
  if (asked.length >= MIN_QUESTIONS && best.maxGain < STOP_GAIN_FRACTION * openingGain(space, intent)) return null;
  return best.question;
}

/** Estimated total quiz length for the progress UI ("3 of ~7"). */
export function estimateTotal(space: TasteSpace, asked: AskedQuestion[], intent: Intent): number {
  const askedIds = new Set(asked.map((item) => item.questionId));
  const basis = answeredBasis(space, asked);
  const threshold = STOP_GAIN_FRACTION * openingGain(space, intent);
  let informative = 0;
  for (const question of eligibleForIntent(space, intent)) {
    if (askedIds.has(question.id)) continue;
    if (questionGain(space, question, basis) >= threshold) informative += 1;
  }
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, asked.length + informative));
}
