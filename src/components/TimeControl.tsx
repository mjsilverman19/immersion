import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { TIME_MODES, type TimeMode } from "@/lib/hexIndex";
import { cn } from "@/lib/utils";

interface TimeControlProps {
  mode: TimeMode;
  onChange: (mode: TimeMode) => void;
  className?: string;
}

/**
 * A quiet pill that retimes the activity surface. In steady state it shows only
 * the active window (just "now" by default); tapping it opens the fuller set of
 * time windows. Sits on the freed bottom edge so it never competes with the chips.
 */
export const TimeControl = ({ mode, onChange, className }: TimeControlProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = TIME_MODES.find((m) => m.id === mode) ?? TIME_MODES[0];

  // Close on any tap outside the control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-max max-w-[72vw] rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur">
          <div className="flex flex-wrap gap-1">
            {TIME_MODES.map(({ id, label }) => {
              const isActive = id === mode;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="change time window"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm backdrop-blur transition-colors",
          open
            ? "border-primary bg-background/90 text-foreground"
            : "border-border bg-background/85 text-foreground",
        )}
      >
        <Clock className="h-3.5 w-3.5 text-primary" />
        {active.label}
      </button>
    </div>
  );
};
