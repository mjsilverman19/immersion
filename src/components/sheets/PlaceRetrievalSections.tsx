import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { ComplementResult, SimilarResult } from "@/types/data";

interface PlaceRetrievalSectionsProps {
  similar: SimilarResult[];
  complements: ComplementResult[];
  onSelectPlace: (id: string) => void;
}

export function PlaceRetrievalSections({ similar, complements, onSelectPlace }: PlaceRetrievalSectionsProps) {
  const [showAllComplements, setShowAllComplements] = useState(false);
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  if (!similar.length && !complements.length) return null;
  return (
    <div className="mt-4 space-y-4">
      {complements.length > 0 && (
        <RetrievalSection title="Continue from here" subtitle="Nearby places that complement this one" expanded={showAllComplements} total={complements.length} onExpandedChange={setShowAllComplements}>
          {(showAllComplements ? complements : complements.slice(0, 3)).map((result) => (
            <button key={result.venue.id} type="button" onClick={() => onSelectPlace(result.venue.id)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base">{result.venue.name}</span>
                <span className="mt-0.5 block truncate text-[11px] capitalize text-muted-foreground">{result.venue.category} · {result.reasons[0] ?? "Nearby"}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </RetrievalSection>
      )}
      {similar.length > 0 && (
        <RetrievalSection title="More like this" subtitle="Similar places across the city" expanded={showAllSimilar} total={similar.length} onExpandedChange={setShowAllSimilar}>
          {(showAllSimilar ? similar : similar.slice(0, 3)).map((result) => (
            <button key={result.venue.id} type="button" onClick={() => onSelectPlace(result.venue.id)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base">{result.venue.name}</span>
                <span className="mt-0.5 block truncate text-[11px] capitalize text-muted-foreground">{result.venue.category}{result.venue.neighborhoodId ? ` · ${result.venue.neighborhoodId}` : ""} · {result.reasons[0] ?? "Similar"}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </RetrievalSection>
      )}
    </div>
  );
}

function RetrievalSection({ title, subtitle, expanded, total, onExpandedChange, children }: { title: string; subtitle: string; expanded: boolean; total: number; onExpandedChange: (expanded: boolean) => void; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
      {total > 3 && <button type="button" onClick={() => onExpandedChange(!expanded)} className="mt-2 text-[11px] font-medium text-primary underline underline-offset-4">{expanded ? "Show fewer" : `Show all ${total}`}</button>}
    </div>
  );
}
