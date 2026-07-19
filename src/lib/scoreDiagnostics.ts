import { venueBaseScore, venueContextTerms } from "@/lib/recommendations";
import type { HexTimeMetric } from "@/types/data";

/**
 * Diagnostics for the venue recommender score. The multiplicative form does not
 * *guarantee* quality stays the anchor — the context terms span a wide range —
 * so these measures quantify how much quality vs. place/time actually drives the
 * ranking. Use as a calibration gate: if context dominates quality, retune the
 * term ranges. Pure and dev-only; not shipped in the UI.
 */

export interface VenueScoreSample {
  qualityPrior: number;
  score: number;
  terms: ReturnType<typeof venueContextTerms>;
}

/** Build a sample from the same primitives the ranker uses, so diagnostics and
 *  production scoring can never drift. */
export function buildSample(qualityPrior: number, timeCurve: number, metric: HexTimeMetric | null): VenueScoreSample {
  return {
    qualityPrior,
    score: venueBaseScore(qualityPrior, timeCurve, metric),
    terms: venueContextTerms(timeCurve, metric),
  };
}

export interface TermStat {
  /** Central tendency of the term's log contribution. */
  median: number;
  /** Std of the log contribution — how much this term reorders venues. */
  spread: number;
}

export interface ScoreDiagnostics {
  count: number;
  /** Spearman rank correlation between quality and final score (1 = quality is
   *  the sole ordering; low = context has overturned quality). */
  spearmanQualityVsScore: number;
  /** Fraction of the top-5 by score that fall outside the top-10 by quality. */
  topFiveNotTopTenByQuality: number;
  /** Per-term log-contribution stats; the largest `spread` drives the ranking. */
  logTerm: Record<"quality" | "time" | "activity" | "local" | "tourist", TermStat>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function averageRanks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < indexed.length) {
    let end = start;
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[start].value) end += 1;
    const rank = (start + end) / 2 + 1; // 1-based average rank for ties
    for (let i = start; i <= end; i += 1) ranks[indexed[i].index] = rank;
    start = end + 1;
  }
  return ranks;
}

function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

/** Spearman rank correlation (ties averaged). */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN;
  return pearson(averageRanks(a), averageRanks(b));
}

const ln = (x: number) => Math.log(Math.max(x, 1e-9));

function termStat(values: number[]): TermStat {
  const logs = values.map(ln);
  return { median: median(logs), spread: std(logs) };
}

export function summarizeScores(samples: VenueScoreSample[]): ScoreDiagnostics {
  const quality = samples.map((s) => s.qualityPrior);
  const score = samples.map((s) => s.score);
  const byScore = samples.map((_, i) => i).sort((i, j) => score[j] - score[i]);
  const byQuality = samples.map((_, i) => i).sort((i, j) => quality[j] - quality[i]);
  const topQuality = new Set(byQuality.slice(0, 10));
  const topFive = byScore.slice(0, 5);
  const misses = topFive.filter((i) => !topQuality.has(i)).length;
  return {
    count: samples.length,
    spearmanQualityVsScore: spearman(quality, score),
    topFiveNotTopTenByQuality: topFive.length ? misses / topFive.length : 0,
    logTerm: {
      quality: termStat(samples.map((s) => s.qualityPrior)),
      time: termStat(samples.map((s) => s.terms.time)),
      activity: termStat(samples.map((s) => s.terms.activity)),
      local: termStat(samples.map((s) => s.terms.local)),
      tourist: termStat(samples.map((s) => s.terms.tourist)),
    },
  };
}
