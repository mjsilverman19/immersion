"use client";

import Link from "next/link";

interface UnlockProgressProps {
  remaining: number;
  percentage: number;
  unlocked: boolean;
}

export default function UnlockProgress({ remaining, percentage, unlocked }: UnlockProgressProps) {
  if (unlocked) return null;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ink">
          Log {remaining} more place{remaining !== 1 ? "s" : ""} to unlock
        </p>
        <span className="text-xs text-ink-light">{percentage}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-dark">
        <div
          className="h-full rounded-full bg-rust transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-light">
        Log places in your home city to unlock other cities.
      </p>
      <Link
        href="/log"
        className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:bg-ink/90"
      >
        Log a place
      </Link>
    </div>
  );
}
