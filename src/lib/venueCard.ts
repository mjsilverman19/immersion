import type { TemporalSignature, Venue, WeekHours } from "@/lib/venues";

/** Day labels for the parsed hours (index 0 = Monday). */
export const DAY_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** JS Date.getDay() is Sun..Sat; our hours array is Mon..Sun. Remap. */
export function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** Minutes-from-midnight (may exceed 1440) → "9pm", "2:30am". Lowercase. */
export function formatMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** A single day's ranges → "5pm–2am" / "closed" / "open 24h". */
export function formatDay(ranges: Array<[number, number]> | null): string {
  if (!ranges || ranges.length === 0) return "closed";
  if (ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] >= 1440) return "open 24h";
  return ranges.map(([o, c]) => `${formatMinutes(o)}–${formatMinutes(c)}`).join(", ");
}

export interface HoursStatus {
  openNow: boolean;
  /** A friend-voice, lowercase status line, e.g. "open now, until 11pm". */
  line: string;
}

/**
 * Where the venue stands *right now*: open or closed, and the next hinge time.
 * Handles after-midnight closings by also checking yesterday's ranges spilling
 * past midnight. Returns null when there are no hours to speak from.
 */
export function hoursStatus(hours: WeekHours | null, now: Date = new Date()): HoursStatus | null {
  if (!hours) return null;
  const today = mondayIndex(now.getDay());
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Yesterday's range can run past midnight into today (e.g. closes 2am).
  const yIdx = (today + 6) % 7;
  for (const [, c] of hours[yIdx] ?? []) {
    if (c > 1440 && nowMin < c - 1440) {
      return { openNow: true, line: `open now, until ${formatMinutes(c)}` };
    }
  }

  const todayRanges = hours[today] ?? [];
  for (const [o, c] of todayRanges) {
    if (nowMin >= o && nowMin < c) {
      return { openNow: true, line: `open now, until ${formatMinutes(c)}` };
    }
  }

  // Closed now — find the next opening today, else the next open day.
  const laterToday = todayRanges.find(([o]) => o > nowMin);
  if (laterToday) {
    return { openNow: false, line: `closed now, opens ${formatMinutes(laterToday[0])}` };
  }
  for (let step = 1; step <= 7; step++) {
    const idx = (today + step) % 7;
    const ranges = hours[idx];
    if (ranges && ranges.length) {
      const day = DAY_LABELS[idx];
      const when = step === 1 ? "tomorrow" : day;
      return { openNow: false, line: `closed now, opens ${when} ${formatMinutes(ranges[0][0])}` };
    }
  }
  return { openNow: false, line: "closed" };
}

const EARTH_MI = 3958.8;

/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_MI * 2 * Math.asin(Math.sqrt(s));
}

/** "0.4 mi · 8 min walk" — friend-voice distance line. ~3 mph walking pace. */
export function distanceLine(miles: number): string {
  const dist = miles < 0.19 ? `${Math.round(miles * 5280)} ft` : `${miles.toFixed(1)} mi`;
  const mins = Math.max(1, Math.round((miles / 3) * 60));
  return `${dist} · ${mins} min walk`;
}

/**
 * Deep-link to the platform's maps app for walking directions to the venue.
 * Apple Maps on Apple hardware, Google Maps elsewhere (which itself hands off
 * to the native app on Android).
 */
export function directionsUrl(v: Venue): string {
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const dest = `${v.lat},${v.lng}`;
  const q = encodeURIComponent(v.name);
  return isApple
    ? `https://maps.apple.com/?daddr=${dest}&q=${q}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

export interface TemporalBar {
  label: string;
  /** Raw share (0..1) from the hex signature. */
  value: number;
  /** Height fraction (0..1), normalised to the tallest of the three. */
  height: number;
}

/** The "when locals are around" chart: three bars, tallest normalised to 1. */
export function temporalBars(sig: TemporalSignature): TemporalBar[] {
  const raw = [
    { label: "weeknights", value: sig.weekday_evening },
    { label: "weekends", value: sig.weekend_day },
    { label: "late", value: sig.late_night },
  ];
  const max = Math.max(...raw.map((r) => r.value), 1e-6);
  return raw.map((r) => ({ ...r, height: r.value / max }));
}

/** "restaurant · $$" — lowercase category with price tier when present. */
export function categoryLine(v: Venue): string {
  return v.price_tier ? `${v.category} · ${v.price_tier}` : v.category;
}
