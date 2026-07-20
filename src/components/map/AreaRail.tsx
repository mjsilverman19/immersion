import { ChevronDown, ChevronUp } from "lucide-react";

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
        <div className="place-glass flex max-w-[94vw] items-center rounded-full p-1.5 pl-4">
          <button type="button" onClick={() => onSelect(first.area, first.ranked.venue)} className="min-w-0 text-left">
            <span className="type-eyebrow text-primary">Place to try</span>
            <span className="type-venue ml-2 max-w-[52vw] truncate align-bottom text-[15px]">{first.ranked.venue.name}</span>
            {picks.length > 1 && <span className="type-body ml-1 text-muted-foreground">+{picks.length - 1}</span>}
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
      <button type="button" onClick={() => onCollapsedChange(true)} aria-label="Minimize place recommendations" className="brand-icon-button absolute -top-4 right-4 z-10 min-h-9 min-w-9 p-2 text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="flex w-full justify-center gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide" aria-label="Places to try">
        {picks.map(({ area, ranked }, index) => (
          <button
            key={ranked.venue.id}
            type="button"
            onClick={() => onSelect(area, ranked.venue)}
            className="place-glass min-w-[9.5rem] max-w-[11.5rem] shrink-0 rounded-2xl px-3.5 py-2.5 text-left transition hover:border-primary/35 hover:bg-background/75"
          >
            <span className="type-eyebrow block text-primary">{index === 0 ? "Top pick" : "Also for you"}</span>
            <span className="type-venue mt-0.5 block truncate">{ranked.venue.name}</span>
            <span className="type-body mt-1 block truncate capitalize text-muted-foreground">{ranked.venue.category} · {area.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
