import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

import type { Venue } from "@/lib/venues";
import { categoryLine } from "@/lib/venueCard";
import { cn } from "@/lib/utils";

interface MapSearchProps {
  open: boolean;
  query: string;
  onOpen: () => void;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}

/** The search affordance in the top bar: a quiet button that expands to an input. */
export const MapSearch = ({ open, query, onOpen, onQueryChange, onClose }: MapSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="search venues"
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur"
      >
        <Search className="h-[18px] w-[18px] stroke-[1.75]" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur">
      <Search className="h-[18px] w-[18px] shrink-0 stroke-[1.75] text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="find a place by name"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="close search"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4 stroke-[1.75]" />
      </button>
    </div>
  );
};

interface SearchResultsProps {
  results: Venue[];
  query: string;
  onSelect: (venue: Venue) => void;
  className?: string;
}

/** The results as a bottom-sheet list, mirroring the pins on the map. */
export const SearchResults = ({ results, query, onSelect, className }: SearchResultsProps) => (
  <div
    className={cn(
      "pointer-events-auto mx-auto max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.12)]",
      className,
    )}
  >
    {results.length === 0 ? (
      <p className="px-5 py-4 text-sm text-muted-foreground">
        nothing named “{query.trim()}” nearby
      </p>
    ) : (
      <ul className="max-h-[42vh] divide-y divide-border overflow-y-auto scrollbar-hide">
        {results.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onSelect(v)}
              className="flex w-full items-baseline justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0">
                <span className="block truncate font-serif text-[18px] leading-tight text-foreground">
                  {v.name}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                  {categoryLine(v)} · {v.neighborhood}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                index {v.index_score}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);
