import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { metricAt } from "@/lib/baselineScore";
import { venueBaseScore } from "@/lib/recommendations";
import type { CategoryCurves, HexDayRecord, VenueRecord } from "@/types/data";

// Parity guard: the client venue score S(v,t) must reproduce the offline
// engine's recommender score on the shipped, compacted artifacts. Expected
// values come from pipeline/generate_golden_scores.py (the engine formula on the
// same inputs). Because the fixture's `expected` uses the engine day-of-week
// (Mon=0) while this test indexes category curves via the exporter's shipped
// `dayOfWeek` field, a passing test also proves the WS9 day-slice fix is intact.

const DATA_ROOT = resolve(__dirname, "../../public/data/nyc");
const read = (path: string) => JSON.parse(readFileSync(path, "utf-8"));

type CompactRecord = [number[], number[], number[], [number, number, number]];
interface GoldenRow {
  venueId: string;
  category: VenueRecord["category"];
  h3: string;
  day: string;
  hour: number;
  expected: number;
}
interface Golden {
  rows: GoldenRow[];
  neutral: { venueId: string; fc: number; expected: number };
}

const golden: Golden = read(resolve(__dirname, "venueScores.golden.json"));
const venues: VenueRecord[] = read(resolve(DATA_ROOT, "venues.json"));
const curves: CategoryCurves = read(resolve(DATA_ROOT, "category_curves.json"));
const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

const dayCache = new Map<string, { dayOfWeek: number; records: Record<string, CompactRecord> }>();
const loadDay = (day: string) => {
  const cached = dayCache.get(day);
  if (cached) return cached;
  const parsed = read(resolve(DATA_ROOT, `hex_metrics-${day}.json`));
  dayCache.set(day, parsed);
  return parsed;
};

const toHexDayRecord = (compact: CompactRecord): HexDayRecord => ({
  activity: compact[0],
  localOrientation: compact[1],
  visitorPressure: compact[2],
  confidence: { activity: compact[3][0], localOrientation: compact[3][1], visitorPressure: compact[3][2] },
});

describe("venue S(v,t) parity with the offline engine", () => {
  it("reproduces engine s_full on shipped compacted inputs", () => {
    expect(golden.rows.length).toBeGreaterThan(0);
    for (const row of golden.rows) {
      const venue = venuesById.get(row.venueId);
      expect(venue, `venue ${row.venueId} present in venues.json`).toBeDefined();
      const day = loadDay(row.day);
      const compact = day.records[row.h3];
      expect(compact, `hex ${row.h3} present in ${row.day} metrics`).toBeDefined();
      const metric = metricAt(toHexDayRecord(compact), row.hour);
      // Curve indexed by the exporter's engine dow — the same path timeFit uses.
      const timeCurve = curves[venue!.category][day.dayOfWeek * 24 + row.hour];
      const actual = venueBaseScore(venue!.qualityPrior, timeCurve, metric);
      expect(actual, `${row.venueId} ${row.day} ${row.hour}:00`).toBeCloseTo(row.expected, 3);
    }
  });

  it("falls back to pure quality × time when the venue's hex has no metrics", () => {
    const venue = venuesById.get(golden.neutral.venueId);
    expect(venue).toBeDefined();
    const actual = venueBaseScore(venue!.qualityPrior, golden.neutral.fc, null);
    expect(actual).toBeCloseTo(golden.neutral.expected, 3);
  });
});
