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

export function formatTypicalTime(day: WeekdayKey, hour: number): string {
  const weekday = WEEKDAYS.find((entry) => entry.key === day)?.label ?? "Saturday";
  const date = new Date(2026, 0, 3, Math.max(0, Math.min(23, hour)));
  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `Typical ${weekday} at ${clock}`;
}
