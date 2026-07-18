/**
 * The hex activity index (public/data/hex-index.json), keyed by H3 id.
 *
 * Task 8 rewrite: the rendered signal is no longer a citywide percentile (a pure
 * volume rank that lit every avenue in every bucket). It is a *self-referential
 * trend* — per hex, per bucket, the last complete week's member volume against
 * that hex+bucket's own trailing-weeks baseline:
 *
 *   gz[bucket]  robust z (median + MAD). Drives existence: a corridor renders
 *               only where its hex clears the bucket's threshold. A steadily-busy
 *               avenue sits at its own median → z≈0 → plain ink.
 *   gr[bucket]  the ratio x / median — the "1.4× its Tuesday-night baseline" caption.
 *
 * Absolute brightness comes from a separate 168-hour curve (hex-curve.json),
 * evaluated at the live minute, so the tint moves continuously instead of stepping
 * between six buckets.
 */
export interface HexEntry {
  lat: number;
  lng: number;
  low_signal: boolean;
  /** Per-bucket longitudinal gate z (existence) and ratio (caption). */
  gz?: Record<BucketKey, number>;
  gr?: Record<BucketKey, number>;
  /** Retained for the untouched venue-scoring / card paths — not used by the tint. */
  local_percentile?: number | null;
  visitor_percentile?: number | null;
  saturation?: number | null;
}

export type HexIndex = Record<string, HexEntry>;

/** 168-hour normalized member curve per hex (public/data/hex-curve.json). Each
 *  value is 0..1 against the hex's own weekly peak; index = day*24 + hour, with
 *  day 0 = Sunday to match JS `Date.getDay()`. */
export type HexCurves = Record<string, number[]>;

/** The six temporal buckets the pipeline ships per hex. */
export const BUCKET_KEYS = [
  "weekday_morning",
  "weekday_midday",
  "weekday_evening",
  "weekend_day",
  "weekend_night",
  "late",
] as const;
export type BucketKey = (typeof BUCKET_KEYS)[number];

/**
 * The time control's modes. `now` follows the device clock; the rest each map to
 * one bucket and a representative time within it (used to evaluate the curve).
 */
export type TimeMode =
  | "now"
  | "morning"
  | "midday"
  | "evening"
  | "late"
  | "weekend_day"
  | "weekend_night";

/** Mode → bucket, plus the friendly label the control shows. */
export const TIME_MODES: { id: TimeMode; label: string; bucket?: BucketKey }[] = [
  { id: "now", label: "now" },
  { id: "morning", label: "mornings", bucket: "weekday_morning" },
  { id: "midday", label: "middays", bucket: "weekday_midday" },
  { id: "evening", label: "evenings", bucket: "weekday_evening" },
  { id: "late", label: "late night", bucket: "late" },
  { id: "weekend_day", label: "weekend days", bucket: "weekend_day" },
  { id: "weekend_night", label: "weekend nights", bucket: "weekend_night" },
];

/**
 * Map a device-local time to a bucket. Weekday vs weekend by day, then the hour
 * ranges; anything outside every window falls to `late`. The Fri/Sat night window
 * claims the 20:00–02:00 edge.
 */
export function resolveNowBucket(d: Date): BucketKey {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const h = d.getHours();
  const isWeekendNight =
    ((day === 5 || day === 6) && h >= 20) || ((day === 6 || day === 0) && h < 2);
  if (isWeekendNight) return "weekend_night";
  const isWeekend = day === 0 || day === 6;
  if (isWeekend && h >= 9 && h < 17) return "weekend_day";
  const isWeekday = day >= 1 && day <= 5;
  if (isWeekday && h >= 7 && h < 11) return "weekday_morning";
  if (isWeekday && h >= 11 && h < 17) return "weekday_midday";
  if (isWeekday && h >= 17 && h < 23) return "weekday_evening";
  return "late";
}

const MODE_BUCKET: Record<Exclude<TimeMode, "now">, BucketKey> = {
  morning: "weekday_morning",
  midday: "weekday_midday",
  evening: "weekday_evening",
  late: "late",
  weekend_day: "weekend_day",
  weekend_night: "weekend_night",
};

/** Resolve the control's mode + the current day into a concrete bucket. */
export function modeToBucket(mode: TimeMode, d: Date = new Date()): BucketKey {
  return mode === "now" ? resolveNowBucket(d) : MODE_BUCKET[mode];
}

/** A representative (day, hour, minute) for a fixed mode — where in the week we
 *  sample the hourly curve. `now` uses the live clock instead. Weekdays sample
 *  Wednesday; weekend modes sample Saturday. */
type Clock = { day: number; hour: number; minute: number };
const MODE_CLOCK: Record<Exclude<TimeMode, "now">, Clock> = {
  morning: { day: 3, hour: 8, minute: 30 },
  midday: { day: 3, hour: 13, minute: 0 },
  evening: { day: 3, hour: 20, minute: 0 },
  late: { day: 3, hour: 1, minute: 0 },
  weekend_day: { day: 6, hour: 13, minute: 0 },
  weekend_night: { day: 6, hour: 22, minute: 30 },
};

export function modeToClock(mode: TimeMode, d: Date = new Date()): Clock {
  return mode === "now"
    ? { day: d.getDay(), hour: d.getHours(), minute: d.getMinutes() }
    : MODE_CLOCK[mode];
}

/** Sample a 168-hour curve at a clock position, linearly between the two bounding
 *  hours (wrapping Sat 23:00 → Sun 00:00). Returns 0..1; 1.0 (flat) if no curve. */
export function curveAt(curve: number[] | undefined, clock: Clock): number {
  if (!curve || curve.length !== 168) return 1;
  const pos = clock.day * 24 + clock.hour + clock.minute / 60;
  const i0 = Math.floor(pos) % 168;
  const i1 = (i0 + 1) % 168;
  const f = pos - Math.floor(pos);
  return curve[i0] * (1 - f) + curve[i1] * f;
}

/** One eligible corridor segment (public/data/streets.geojson feature props).
 *  `gi` maps each bucket the pipeline lights this segment in to a 0..1 render
 *  intensity (its trend-z magnitude — hotter corridors render boldest); absent
 *  buckets aren't lit. `vf` is the venue-density damper; `vs` visitor metadata. */
export interface StreetProps {
  id: string;
  p: string;
  vf: number;
  vs?: number;
  name?: string;
  gi?: Partial<Record<BucketKey, number>>;
}

/** Brightness floor: a lit corridor is *always* clearly visible. The hourly curve
 *  (normalized to the hex's own daytime peak) only modulates the top of the range
 *  — otherwise a corridor that's unusually alive at 1am would render near black,
 *  since its curve sits well below its noon peak. */
const BRIGHT_FLOOR = 0.62;

/**
 * The displayed weight (0..vf) for a corridor segment at a given bucket + clock:
 * zero unless the pipeline lit it in this bucket, otherwise its trend intensity
 * (hotter = bolder) shaped by the hex's live hourly brightness and damped by
 * venue density. Existence + magnitude are the local gate; the curve modulates.
 */
export function segmentWeight(
  props: StreetProps,
  curves: HexCurves,
  bucket: BucketKey,
  clock: Clock,
): number {
  const gi = props.gi?.[bucket];
  if (!gi) return 0;
  const curve = curveAt(curves[props.p], clock);
  return props.vf * gi * (BRIGHT_FLOOR + (1 - BRIGHT_FLOOR) * curve);
}

/** A chained corridor run for the low-zoom view (public/data/runs.json). */
export interface Run {
  seg_ids: string[];
  blocks: number;
  peak_z: number;
  peak_ratio: number;
  name: string | null;
  coords: [number, number][][]; // MultiLineString parts
}
export interface RunsBucket {
  threshold: number;
  shown: number;
  runs: Run[];
}
export interface RunsData {
  total_segments: number;
  buckets: Record<BucketKey, RunsBucket>;
}
