import { useEffect, useState } from "react";
import { Bookmark, Check, ExternalLink, Heart, Maximize2, Minimize2, X } from "lucide-react";

import { PlaceRetrievalSections } from "@/components/sheets/PlaceRetrievalSections";
import { TasteRadar } from "@/components/taste/TasteRadar";
import { googleMapsPlaceUrl } from "@/lib/placeLinks";
import type {
  ComplementResult,
  RadarEvidence,
  SimilarResult,
  TasteProfile,
  UserPlaceState,
  VenueRecord,
} from "@/types/data";

interface PlaceDetailSheetProps {
  venue: VenueRecord;
  contextLabel: string;
  tasteProfile: TasteProfile | null;
  evidence: RadarEvidence;
  state: UserPlaceState | undefined;
  onUpdate: (patch: Partial<UserPlaceState>) => void;
  onViewOnMaps: () => void;
  onShapeTaste: () => void;
  onClose: () => void;
  similar: SimilarResult[];
  complements: ComplementResult[];
  onSelectPlace: (id: string) => void;
}

export function PlaceDetailSheet({
  venue,
  contextLabel,
  tasteProfile,
  evidence,
  state,
  onUpdate,
  onViewOnMaps,
  onShapeTaste,
  onClose,
  similar,
  complements,
  onSelectPlace,
}: PlaceDetailSheetProps) {
  const [minimized, setMinimized] = useState(false);
  const [learningFeedback, setLearningFeedback] = useState<string | null>(null);
  useEffect(() => {
    setMinimized(false);
    setLearningFeedback(null);
  }, [venue.id]);

  const place = state ?? {
    venueId: venue.id,
    saved: false,
    visited: false,
    endorsed: false,
    updatedAt: "",
  };

  if (minimized) {
    return (
      <aside className="place-glass absolute bottom-3 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full p-1.5 pl-4 md:bottom-5 md:left-5 md:translate-x-0">
        <button type="button" onClick={() => setMinimized(false)} className="min-w-0 text-left">
          <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">Place</span>
          <span className="ml-2 max-w-[55vw] truncate align-bottom font-serif text-sm">{venue.name}</span>
        </button>
        <button type="button" onClick={() => setMinimized(false)} aria-label="Expand place details" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close place details" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="place-glass absolute inset-x-2 bottom-2 z-50 mx-auto max-h-[calc(100dvh-7.5rem)] max-w-md overflow-y-auto rounded-3xl md:inset-x-auto md:bottom-5 md:left-5 md:max-h-[82dvh] md:w-[400px]">
      <div className="p-5 pb-0">
        <button type="button" onClick={onClose} aria-label="Close place details" className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize place details" className="absolute right-12 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted">
          <Minimize2 className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{contextLabel}</p>
        <h2 className="mt-1 pr-16 font-serif text-4xl leading-[0.98]">{venue.name}</h2>
        <p className="mt-2 text-sm capitalize text-muted-foreground">
          {venue.category}{venue.neighborhoodId ? ` · ${venue.neighborhoodId}` : ""}
        </p>

        <TasteRadar tasteProfile={tasteProfile} evidence={evidence} onShapeTaste={onShapeTaste} />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PlaceAction
            active={place.saved}
            label="Save"
            icon={<Bookmark className="h-4 w-4" />}
            onClick={() => {
              onUpdate({ saved: !place.saved });
              setLearningFeedback(!place.saved ? "Saved to your map." : null);
            }}
          />
          <PlaceAction
            active={place.visited}
            label="Been here"
            icon={<Check className="h-4 w-4" />}
            onClick={() => onUpdate({ visited: !place.visited })}
          />
          <PlaceAction
            active={place.endorsed}
            label="Recommend"
            icon={<Heart className="h-4 w-4" />}
            onClick={() => {
              onUpdate({ endorsed: !place.endorsed });
              setLearningFeedback(!place.endorsed ? "Added to your taste." : null);
            }}
          />
        </div>

        {learningFeedback && (
          <p role="status" className="mt-3 text-center text-[11px] text-muted-foreground">{learningFeedback}</p>
        )}

        {place.endorsed && (
          <label className="mt-4 block text-sm font-medium">
            Why would you recommend it?
            <textarea
              value={place.note ?? ""}
              onChange={(event) => onUpdate({ note: event.target.value })}
              placeholder="Optional note for a friend"
              className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-primary"
            />
          </label>
        )}

        <PlaceRetrievalSections
          key={venue.id}
          similar={similar}
          complements={complements}
          onSelectPlace={onSelectPlace}
        />
      </div>

      <div className="sticky bottom-0 mt-5 border-t border-white/50 bg-background/75 px-5 pb-4 pt-3 backdrop-blur-xl">
        <a
          href={googleMapsPlaceUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onViewOnMaps();
            setLearningFeedback("Opened in Google Maps.");
          }}
          className="brand-primary-button flex items-center justify-center gap-2 text-sm"
        >
          <ExternalLink className="h-4 w-4" /> View on Google Maps
        </a>
      </div>
    </aside>
  );
}

function PlaceAction({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] ${active ? "border-primary bg-primary text-primary-foreground" : "border-white/50 bg-background/40 text-foreground hover:border-primary/35 hover:bg-background/60"}`}
    >
      {icon}<span>{label}</span>
    </button>
  );
}
