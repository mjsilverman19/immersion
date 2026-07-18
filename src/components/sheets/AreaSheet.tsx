import { useEffect, useState } from "react";
import { ChevronRight, Maximize2, Minimize2, Route, X } from "lucide-react";

import { formatTypicalTime } from "@/lib/time";
import type { SelectedArea, VenueRecord, WeekdayKey } from "@/types/data";

export function AreaSheet({ selected, day, hour, onClose, onSelectVenue }: { selected: SelectedArea | null; day: WeekdayKey; hour: number; onClose: () => void; onSelectVenue: (venue: VenueRecord) => void }) {
  const [minimized, setMinimized] = useState(true);
  useEffect(() => setMinimized(true), [selected?.id]);
  if (!selected) return null;
  if (minimized) return <aside className="absolute bottom-[172px] left-1/2 z-40 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/96 p-1.5 pl-4 shadow-xl backdrop-blur md:bottom-5 md:left-5 md:translate-x-0">
    <button type="button" onClick={() => setMinimized(false)} className="min-w-0 text-left"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">Where to look</span><span className="ml-2 max-w-[55vw] truncate align-bottom font-serif text-sm">{selected.name}</span></button>
    <button type="button" onClick={() => setMinimized(false)} aria-label="Expand area details" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
    <button type="button" onClick={onClose} aria-label="Close area details" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
  </aside>;
  return (
    <aside className="absolute inset-x-2 bottom-2 z-40 mx-auto max-h-[68dvh] max-w-lg overflow-y-auto rounded-3xl border border-border bg-background/97 p-5 shadow-2xl backdrop-blur md:inset-x-auto md:bottom-5 md:left-5 md:w-[390px]">
      <button type="button" onClick={onClose} aria-label="Close area details" className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize area details" className="absolute right-12 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><Minimize2 className="h-4 w-4" /></button>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Where to look</p>
      <h2 className="mt-1 pr-8 font-serif text-3xl leading-tight">{selected.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{selected.borough} · {formatTypicalTime(day, hour)}{selected.distanceMiles !== undefined ? ` · ${selected.distanceMiles.toFixed(1)} mi` : ""}</p>
      <div className="mt-4 rounded-2xl bg-muted/65 p-4">
        <h3 className="text-sm font-semibold">Why we recommend this area</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{selected.contributions.map((item) => <li key={item.feature}>• {item.label}</li>)}</ul>
      </div>
      <p className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/45 px-3 py-2 text-[11px] text-muted-foreground"><Route className="h-4 w-4 shrink-0" /> Deeper neutral shading and streets indicate a stronger modeled typical activity pattern—not live traffic or measured footfall.</p>
      <div className="mt-5 flex items-end justify-between"><div><h3 className="font-serif text-2xl">Places to explore</h3><p className="text-[11px] text-muted-foreground">{selected.recommendedVenues[0]?.recommendationLabel === "People like you" ? "Stronger fits based on your taste choices, without a universal ranking." : "Stronger fits inside this area, without a universal ranking."}</p></div><span className="text-[10px] text-muted-foreground">{selected.recommendedVenues.length} shown</span></div>
      <div className="mt-3 space-y-2">
        {selected.recommendedVenues.map(({ venue, contributions }) => <button key={venue.id} type="button" onClick={() => onSelectVenue(venue)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left hover:border-primary/50">
          <span className="min-w-0 flex-1"><span className="block truncate font-serif text-xl">{venue.name}</span><span className="mt-0.5 block truncate text-[11px] capitalize text-muted-foreground">{venue.category} · {contributions[0]?.label ?? "Fits this part of the map"}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>)}
        {!selected.recommendedVenues.length && <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No matching venues are available in this area for the current intent.</p>}
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">{selected.confidence >= 0.7 ? "High" : selected.confidence >= 0.4 ? "Moderate" : "Limited"} area confidence · Based on a modeled typical week and supporting place evidence—not a live count.</p>
    </aside>
  );
}
