/**
 * Taste vector computation module.
 *
 * An 8-dimensional taste vector represents a user's preferences:
 *   [0] Quiet (-) / Lively (+)
 *   [1] Budget (-) / Splurge (+)
 *   [2] Solo (-) / Social (+)
 *   [3] Cautious (-) / Adventurous (+)
 *   [4] Linger (-) / Move (+)
 *   [5] Morning (-) / Night (+)
 *   [6] Food-focused (-) / Broad (+)
 *   [7] Planned (-) / Spontaneous (+)
 */

const VECTOR_SIZE = 8;

// ── Onboarding vector ──────────────────────────────────────────────

export interface OnboardingChoice {
  vectorDirection: number[];
  choseB: boolean;
}

/**
 * Compute a taste vector from onboarding quiz choices.
 *
 * For each choice, adds the direction vector to an accumulator.
 * Option A = subtract direction, Option B = add direction.
 * Normalizes the result to unit length.
 */
export function computeOnboardingVector(choices: OnboardingChoice[]): number[] {
  const acc = new Array<number>(VECTOR_SIZE).fill(0);

  for (const { vectorDirection, choseB } of choices) {
    const sign = choseB ? 1 : -1;
    for (let i = 0; i < VECTOR_SIZE; i++) {
      acc[i] += sign * (vectorDirection[i] ?? 0);
    }
  }

  return normalize(acc);
}

// ── Behavioral vector ──────────────────────────────────────────────

export interface LogData {
  rating: number;
  tags: string[];
  vibe_tags: string[];
  category: string;
}

// Vibe tags that map to specific dimensions
const QUIET_TAGS = new Set(["quiet", "go alone", "morning ritual"]);
const LIVELY_TAGS = new Set(["lively", "late night", "group-friendly", "people-watching"]);
const BUDGET_TAGS = new Set(["no-frills", "hole in the wall", "cash only"]);
const SPLURGE_TAGS = new Set(["splurge-worthy", "reservations recommended", "date-worthy"]);
const SOLO_TAGS = new Set(["go alone", "quiet"]);
const SOCIAL_TAGS = new Set(["group-friendly", "date-worthy", "people-watching"]);
const ADVENTUROUS_TAGS = new Set(["one-of-a-kind", "off the beaten path"]);
const CAUTIOUS_TAGS = new Set(["neighborhood staple", "local institution"]);
const LINGER_TAGS = new Set(["worth the wait", "order everything"]);
const MOVE_TAGS = new Set(["off the beaten path"]);
const MORNING_TAGS = new Set(["morning ritual"]);
const NIGHT_TAGS = new Set(["late night"]);

const FOOD_CATEGORIES = new Set(["restaurant", "cafe", "bar"]);
const BROAD_CATEGORIES = new Set(["park", "shop", "viewpoint", "experience"]);

/**
 * Compute a behavioral taste vector from a user's log history.
 * Returns null if fewer than 3 logs (not enough signal).
 *
 * Maps hand-engineered features to the 8 taste dimensions:
 * - Tag patterns → atmosphere, social, adventurousness, tempo, time-of-day
 * - Rating variance → cautious/adventurous (high variance = adventurous)
 * - Category distribution → food-focused/broad
 */
export function computeBehavioralVector(logs: LogData[]): number[] | null {
  if (logs.length < 3) return null;

  const scores = new Array<number>(VECTOR_SIZE).fill(0);
  const counts = new Array<number>(VECTOR_SIZE).fill(0);

  // Collect all tags across logs
  for (const log of logs) {
    const allTags = [...log.tags, ...log.vibe_tags];

    for (const tag of allTags) {
      // Dim 0: Quiet / Lively
      if (QUIET_TAGS.has(tag)) { scores[0] -= 1; counts[0]++; }
      if (LIVELY_TAGS.has(tag)) { scores[0] += 1; counts[0]++; }

      // Dim 1: Budget / Splurge
      if (BUDGET_TAGS.has(tag)) { scores[1] -= 1; counts[1]++; }
      if (SPLURGE_TAGS.has(tag)) { scores[1] += 1; counts[1]++; }

      // Dim 2: Solo / Social
      if (SOLO_TAGS.has(tag)) { scores[2] -= 1; counts[2]++; }
      if (SOCIAL_TAGS.has(tag)) { scores[2] += 1; counts[2]++; }

      // Dim 3: Cautious / Adventurous (from tags)
      if (CAUTIOUS_TAGS.has(tag)) { scores[3] -= 1; counts[3]++; }
      if (ADVENTUROUS_TAGS.has(tag)) { scores[3] += 1; counts[3]++; }

      // Dim 4: Linger / Move
      if (LINGER_TAGS.has(tag)) { scores[4] -= 1; counts[4]++; }
      if (MOVE_TAGS.has(tag)) { scores[4] += 1; counts[4]++; }

      // Dim 5: Morning / Night
      if (MORNING_TAGS.has(tag)) { scores[5] -= 1; counts[5]++; }
      if (NIGHT_TAGS.has(tag)) { scores[5] += 1; counts[5]++; }
    }
  }

  // Dim 3: Rating variance → adventurousness signal
  // High variance means they try diverse things (adventurous)
  const ratings = logs.map((l) => l.rating);
  const meanRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((sum, r) => sum + (r - meanRating) ** 2, 0) / ratings.length;
  // Map variance to [-1, 1]: low variance (<0.5) → cautious, high (>2) → adventurous
  const varianceSignal = Math.min(Math.max((variance - 1) / 1.5, -1), 1);
  scores[3] += varianceSignal;
  counts[3]++;

  // Dim 6: Food-focused / Broad — category distribution
  let foodCount = 0;
  let broadCount = 0;
  for (const log of logs) {
    if (FOOD_CATEGORIES.has(log.category)) foodCount++;
    if (BROAD_CATEGORIES.has(log.category)) broadCount++;
  }
  const total = foodCount + broadCount;
  if (total > 0) {
    // 100% food → -1, 100% broad → +1, 50/50 → 0
    scores[6] = (broadCount - foodCount) / total;
    counts[6] = 1;
  }

  // Dim 7: Planned / Spontaneous
  // "off the beaten path" + "one-of-a-kind" → spontaneous
  // "reservations recommended" + "neighborhood staple" → planned
  // (Already partially captured by tag mapping above, so we add a category signal)
  // Users who log many different categories are more spontaneous
  const uniqueCategories = new Set(logs.map((l) => l.category)).size;
  const categoryDiversity = uniqueCategories / Math.min(logs.length, 7);
  scores[7] += (categoryDiversity - 0.5) * 2; // normalize around 0
  counts[7]++;

  // Normalize each dimension by its count to get an average signal
  for (let i = 0; i < VECTOR_SIZE; i++) {
    if (counts[i] > 0) {
      scores[i] /= counts[i];
    }
  }

  return normalize(scores);
}

// ── Blending ───────────────────────────────────────────────────────

/**
 * Blend onboarding and behavioral vectors using sigmoid weighting.
 *
 * At 0 logs, onboarding is 100%.
 * At ~20 logs, onboarding is ~15%.
 * At ~50 logs, onboarding is negligible.
 *
 * If behavioral is null, returns onboarding unchanged.
 */
export function blendVectors(
  onboarding: number[],
  behavioral: number[] | null,
  logCount: number
): number[] {
  if (!behavioral) return onboarding;

  // Sigmoid: onboardingWeight = 1 / (1 + e^((logCount - 10) / 5))
  // At 0 logs: ~0.88, at 10: 0.5, at 20: ~0.12, at 50: ~0.0003
  const onboardingWeight = 1 / (1 + Math.exp((logCount - 10) / 5));
  const behavioralWeight = 1 - onboardingWeight;

  const blended = new Array<number>(VECTOR_SIZE);
  for (let i = 0; i < VECTOR_SIZE; i++) {
    blended[i] =
      onboardingWeight * (onboarding[i] ?? 0) +
      behavioralWeight * (behavioral[i] ?? 0);
  }

  return normalize(blended);
}

// ── Similarity ─────────────────────────────────────────────────────

/**
 * Standard cosine similarity between two vectors.
 * Returns a value from -1 (opposite) to 1 (identical).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < VECTOR_SIZE; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Normalize a vector to unit length. Returns zero vector if magnitude is 0. */
function normalize(v: number[]): number[] {
  let mag = 0;
  for (let i = 0; i < v.length; i++) {
    mag += v[i] * v[i];
  }
  mag = Math.sqrt(mag);

  if (mag === 0) return new Array<number>(v.length).fill(0);

  return v.map((x) => x / mag);
}
