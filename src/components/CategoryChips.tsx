import type { CSSProperties } from "react";

import type { Intent } from "@/types/data";
import { INTENT_ORDER, INTENT_VISUALS } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const INTENTS = INTENT_ORDER.map((id) => ({ id, label: INTENT_VISUALS[id].label }));

export function CategoryChips({ active, onChange, className }: { active: Intent; onChange: (intent: Intent) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto scrollbar-hide", className)} aria-label="What are you looking for?">
      {INTENTS.map(({ id, label }) => {
        const visual = INTENT_VISUALS[id];
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={selected}
            style={selected ? ({ borderColor: `${visual.color}99`, backgroundColor: `${visual.color}16`, "--intent-color": visual.color } as CSSProperties) : undefined}
            className={cn(
              "relative min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-semibold text-foreground backdrop-blur-xl transition-colors",
              selected ? "pl-6 shadow-[0_3px_12px_rgba(36,34,31,0.05)]" : "border-white/50 bg-background/60 shadow-[0_2px_10px_rgba(36,34,31,0.04)] hover:bg-background/75",
            )}
          >
            {selected && <span aria-hidden="true" className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--intent-color)]" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
