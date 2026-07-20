import type { WeekdayKey } from "@/types/data";

export const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: "sun", label: "Sunday", short: "Sun" },
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
];

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

/** NYC local weekday + hour for the typical-week model (not the viewer's TZ). */
export function currentTypicalTime(now: Date = new Date()): { day: WeekdayKey; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sat";
  const hourRaw = parts.find((part) => part.type === "hour")?.value ?? "15";
  const hour = Number.parseInt(hourRaw, 10);

  return {
    day: WEEKDAY_FROM_SHORT[weekday] ?? "sat",
    hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, hour === 24 ? 0 : hour)) : 15,
  };
}

export function formatTypicalTime(day: WeekdayKey, hour: number): string {
  const weekday = WEEKDAYS.find((entry) => entry.key === day)?.label ?? "Saturday";
  const date = new Date(2026, 0, 3, Math.max(0, Math.min(23, hour)));
  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `Typical ${weekday} at ${clock}`;
}
