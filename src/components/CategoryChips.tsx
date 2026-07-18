import type { Intent } from "@/types/data";
import { cn } from "@/lib/utils";

export const INTENTS: Array<{ id: Intent; label: string }> = [
  { id: "anything", label: "Anything" },
  { id: "eat", label: "Eat" },
  { id: "drink", label: "Drink" },
  { id: "coffee", label: "Coffee" },
  { id: "culture", label: "Culture" },
  { id: "outside", label: "Outside" },
  { id: "nightlife", label: "Go out" },
];

export function CategoryChips({ active, onChange, className }: { active: Intent; onChange: (intent: Intent) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto scrollbar-hide", className)} aria-label="What are you looking for?">
      {INTENTS.map(({ id, label }) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={active === id} className={cn(
          "shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-medium shadow-sm backdrop-blur transition-colors",
          active === id ? "border-foreground bg-foreground text-background" : "border-border bg-background/90 text-foreground hover:bg-background",
        )}>{label}</button>
      ))}
    </div>
  );
}
