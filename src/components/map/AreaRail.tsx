import { ChevronDown, ChevronUp, MapPin, Sparkles } from "lucide-react";

import type { SelectedArea, VenueRecord } from "@/types/data";

interface AreaRailProps {
  areas: SelectedArea[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSelect: (area: SelectedArea, venue: VenueRecord) => void;
}

export function AreaRail({ areas, collapsed, onCollapsedChange, onSelect }: AreaRailProps) {
  const picks = areas.flatMap((area) => {
    const ranked = area.recommendedVenues[0];
    return ranked ? [{ area, ranked }] : [];
  });
  const first = picks[0];
  if (!first) return null;

  if (collapsed) {
    return (
      <div className="flex justify-center px-3">
        <div className="flex max-w-[94vw] items-center rounded-full border border-border bg-background/94 p-1.5 pl-4 shadow-lg backdrop-blur">
          <button type="button" onClick={() => onSelect(first.area, first.ranked.venue)} className="min-w-0 text-left">
            <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">Place to try</span>
            <span className="ml-2 max-w-[52vw] truncate align-bottom font-serif text-sm">{first.ranked.venue.name}</span>
            {picks.length > 1 && <span className="ml-1 text-[10px] text-muted-foreground">+{picks.length - 1}</span>}
          </button>
          <button type="button" onClick={() => onCollapsedChange(false)} aria-label="Expand place recommendations" className="ml-2 rounded-full p-2 text-muted-foreground hover:bg-muted">
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full md:max-w-3xl">
      <button type="button" onClick={() => onCollapsedChange(true)} aria-label="Minimize place recommendations" className="absolute -top-4 right-4 z-10 rounded-full border border-border bg-background p-2 text-muted-foreground shadow-md hover:text-foreground">
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="flex w-full gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide" aria-label="Places to try">
        {picks.map(({ area, ranked }, index) => (
          <button
            key={ranked.venue.id}
            type="button"
            onClick={() => onSelect(area, ranked.venue)}
            className="flex min-w-[230px] flex-1 items-center gap-3 rounded-2xl border border-border bg-background/94 px-3 py-3 text-left shadow-lg backdrop-blur transition hover:border-primary/50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {index === 0 ? <Sparkles className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">{index === 0 ? "Top pick" : "Also for you"}</span>
              <span className="mt-0.5 block truncate font-serif text-xl leading-tight">{ranked.venue.name}</span>
              <span className="mt-1 block truncate text-[10px] capitalize text-muted-foreground">{ranked.venue.category} · {area.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
