import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { metricAt } from "@/lib/baselineScore";
import { buildSample, spearman, summarizeScores } from "@/lib/scoreDiagnostics";
import type { CategoryCurves, HexDayRecord, VenueRecord } from "@/types/data";

const DATA_ROOT = resolve(__dirname, "../../public/data/nyc");
const read = (path: string) => JSON.parse(readFileSync(path, "utf-8"));
type CompactRecord = [number[], number[], number[], [number, number, number]];

const toHexDayRecord = (compact: CompactRecord): HexDayRecord => ({
  activity: compact[0],
  localOrientation: compact[1],
  visitorPressure: compact[2],
  confidence: { activity: compact[3][0], localOrientation: compact[3][1], visitorPressure: compact[3][2] },
});

describe("spearman", () => {
  it("is 1 for a monotonically increasing relation and -1 for reversed", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 6);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 6);
  });
});

describe("summarizeScores", () => {
  it("reports quality as the sole driver when context is uniform", () => {
    const samples = [0.3, 0.6, 0.9].map((q) => buildSample(q, 1, null));
    const d = summarizeScores(samples);
    expect(d.spearmanQualityVsScore).toBeCloseTo(1, 6);
    expect(d.logTerm.activity.spread).toBe(0); // neutral terms => no spread
  });
});

// Calibration gate: on the live NYC dataset, confirm quality remains the anchor
// of the ranking rather than being overwhelmed by place/time context.
describe("live calibration gate (restaurants, Sat 22:00)", () => {
  it("keeps quality dominant in the venue ranking", () => {
    const venues: VenueRecord[] = read(resolve(DATA_ROOT, "venues.json"));
    const curves: CategoryCurves = read(resolve(DATA_ROOT, "category_curves.json"));
    const day = read(resolve(DATA_ROOT, "hex_metrics-sat.json")) as {
      dayOfWeek: number;
      records: Record<string, CompactRecord>;
    };
    const hour = 22;
    const restaurants = venues.filter((v) => v.category === "restaurant" && v.qualityPrior >= 0.2);
    const timeCurve = curves.restaurant[day.dayOfWeek * 24 + hour];
    const samples = restaurants.map((v) => {
      const compact = day.records[v.h3];
      const metric = compact ? metricAt(toHexDayRecord(compact), hour) : null;
      return buildSample(v.qualityPrior, timeCurve, metric);
    });

    const d = summarizeScores(samples);
    // eslint-disable-next-line no-console
    console.log("score diagnostics (restaurants, Sat 22:00):", JSON.stringify(d, null, 2));

    expect(d.count).toBeGreaterThan(50);
    // Quality still orders most of the ranking...
    expect(d.spearmanQualityVsScore).toBeGreaterThan(0.6);
    // ...and quality's log-spread is the largest single reordering force
    // (context is present but subordinate).
    const { quality, activity, local, tourist } = d.logTerm;
    expect(quality.spread).toBeGreaterThan(Math.max(activity.spread, local.spread, tourist.spread));
  });
});
