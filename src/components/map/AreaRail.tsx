import { ChevronDown, ChevronUp, MapPin, Sparkles } from "lucide-react";

import type { SelectedArea } from "@/types/data";

interface AreaRailProps {
  areas: SelectedArea[];
  selectedId: string | null;
  personalized: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelect: (area: SelectedArea) => void;
}

export function AreaRail({ areas, selectedId, personalized, collapsed, onCollapsedChange, onSelect }: AreaRailProps) {
  if (collapsed) {
    return <div className="flex justify-center px-3">
      <div className="flex max-w-[94vw] items-center rounded-full border border-border bg-background/94 p-1.5 pl-4 shadow-lg backdrop-blur">
        <button type="button" onClick={() => onSelect(areas[0])} className="min-w-0 text-left">
          <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">Where to look</span>
          <span className="ml-2 max-w-[52vw] truncate align-bottom font-serif text-sm">{areas[0]?.name}</span>
          {areas.length > 1 && <span className="ml-1 text-[10px] text-muted-foreground">+{areas.length - 1}</span>}
        </button>
        <button type="button" onClick={() => onCollapsedChange(false)} aria-label="Expand area recommendations" className="ml-2 rounded-full p-2 text-muted-foreground hover:bg-muted"><ChevronUp className="h-4 w-4" /></button>
      </div>
    </div>;
  }

  return <div className="relative mx-auto w-full md:max-w-3xl">
    <button type="button" onClick={() => onCollapsedChange(true)} aria-label="Minimize area recommendations" className="absolute -top-4 right-4 z-10 rounded-full border border-border bg-background p-2 text-muted-foreground shadow-md hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
    <div className="flex w-full gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide" aria-label="Where to look">
      {areas.map((area, index) => {
        const reason = area.contributions[0]?.label ?? "A promising mix for this time";
        const secondReason = area.contributions[1]?.label;
        return <button key={area.id} type="button" onClick={() => onSelect(area)} aria-pressed={selectedId === area.id} className={`min-w-[250px] flex-1 rounded-2xl border px-4 py-3 text-left shadow-lg backdrop-blur transition ${selectedId === area.id ? "border-primary bg-background" : "border-border bg-background/94 hover:border-primary/50"}`}>
          <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{index === 0 ? "Start here" : "Also worth a look"}</span>{area.distanceMiles !== undefined && <span className="text-[10px] text-muted-foreground">{area.distanceMiles.toFixed(1)} mi</span>}</div>
          <p className="mt-1 truncate font-serif text-xl">{area.name}</p>
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-foreground"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span><span className="font-semibold">Why:</span> {reason}{secondReason && <span className="mt-0.5 block text-muted-foreground">{secondReason}</span>}</span></div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {area.relevantVenueCount} matching places</span>{personalized && (area.rankChange > 0 || area.personalizationLift > 0.01) && <span className="font-medium text-primary">{area.rankChange > 0 ? `Moved up ${area.rankChange}` : `Taste fit +${Math.round(area.personalizationLift * 100)}%`}</span>}</div>
        </button>;
      })}
    </div>
  </div>;
}
