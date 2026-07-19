import { useEffect, useState } from "react";
import { Bookmark, Check, Heart, Maximize2, Minimize2, Navigation, X } from "lucide-react";

import { PlaceRetrievalSections } from "@/components/sheets/PlaceRetrievalSections";
import { Action } from "@/components/sheets/VenueSheet";
import { TasteRadar } from "@/components/taste/TasteRadar";
import { standaloneRadarEvidence } from "@/lib/recommendations";
import type { ComplementResult, SimilarResult, TasteProfile, UserPlaceState, VenueRecord } from "@/types/data";

interface PlaceSheetProps {
  venue: VenueRecord | null;
  /** Why this venue surfaced — set when arriving via a "more like this" / "continue from here" row. */
  reasons: string[];
  tasteProfile: TasteProfile | null;
  state: UserPlaceState | undefined;
  onUpdate: (patch: Partial<UserPlaceState>) => void;
  onDirections: () => void;
  onClose: () => void;
  similar: SimilarResult[];
  complements: ComplementResult[];
  onSelectPlace: (id: string, reasons: string[]) => void;
}

/**
 * Venue detail for places reached through retrieval ("more like this" /
 * "continue from here") rather than the current area's ranking — often a
 * different neighborhood, or a category the active intent doesn't rank. Mirrors
 * VenueSheet's layout but has no area-scoped score or contributions to show, so
 * it shows the retrieval reasons in their place.
 */
export function PlaceSheet({ venue, reasons, tasteProfile, state, onUpdate, onDirections, onClose, similar, complements, onSelectPlace }: PlaceSheetProps) {
  const [minimized, setMinimized] = useState(false);
  const [learningFeedback, setLearningFeedback] = useState<string | null>(null);
  useEffect(() => { setMinimized(false); setLearningFeedback(null); }, [venue?.id]);
  if (!venue) return null;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  const place = state ?? { venueId: venue.id, saved: false, visited: false, endorsed: false, updatedAt: "" };
  const confidence = venue.featureScores.evidenceConfidence >= 0.7 ? "Strong" : venue.featureScores.evidenceConfidence >= 0.4 ? "Moderate" : "Limited";
  if (minimized) return <aside className="absolute bottom-3 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/98 p-1.5 pl-4 shadow-xl backdrop-blur md:bottom-5 md:left-5 md:translate-x-0">
    <button type="button" onClick={() => setMinimized(false)} className="min-w-0 text-left"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-primary">Place</span><span className="ml-2 max-w-[55vw] truncate align-bottom font-serif text-sm">{venue.name}</span></button>
    <button type="button" onClick={() => setMinimized(false)} aria-label="Expand venue details" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
    <button type="button" onClick={onClose} aria-label="Close venue details" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
  </aside>;
  return (
    <aside className="absolute inset-x-2 bottom-2 z-50 mx-auto max-h-[78dvh] max-w-md overflow-y-auto rounded-3xl border border-border bg-background/98 p-5 shadow-2xl backdrop-blur md:inset-x-auto md:bottom-5 md:left-5 md:w-[350px]">
      <button type="button" onClick={onClose} aria-label="Close venue details" className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize venue details" className="absolute right-12 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><Minimize2 className="h-4 w-4" /></button>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">A place for your map</p>
      <h2 className="mt-1 pr-8 font-serif text-3xl leading-tight">{venue.name}</h2>
      <p className="mt-1 text-sm capitalize text-muted-foreground">{venue.category}{venue.neighborhoodId ? ` · ${venue.neighborhoodId}` : ""}</p>
      <TasteRadar tasteProfile={tasteProfile} evidence={standaloneRadarEvidence(venue)} />
      <div className="mt-5 rounded-2xl bg-muted/65 p-4">
        <h3 className="text-sm font-semibold">Why it's here</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
          {!reasons.length && <li>• Surfaced from a place you were exploring</li>}
        </ul>
        <p className="mt-3 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">Place evidence: {confidence}. This place is outside the current area ranking, so no intent score applies.</p>
      </div>
      <PlaceRetrievalSections similar={similar} complements={complements} onSelectPlace={onSelectPlace} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Action active={place.saved} label="Save" icon={<Bookmark className="h-4 w-4" />} onClick={() => { onUpdate({ saved: !place.saved }); setLearningFeedback(!place.saved ? "Saved. This will slightly improve what appears on your map." : null); }} />
        <Action active={place.visited} label="Been here" icon={<Check className="h-4 w-4" />} onClick={() => onUpdate({ visited: !place.visited })} />
        <Action active={place.endorsed} label="I’d send someone here" icon={<Heart className="h-4 w-4" />} onClick={() => { onUpdate({ endorsed: !place.endorsed }); setLearningFeedback(!place.endorsed ? "Added to your taste. Recommendations like this will carry more weight on future maps." : null); }} />
      </div>
      {learningFeedback && <p role="status" className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">{learningFeedback}</p>}
      {place.endorsed && <label className="mt-4 block text-sm font-medium">Why would you send someone here?<textarea value={place.note ?? ""} onChange={(event) => onUpdate({ note: event.target.value })} placeholder="Optional note for a friend" className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-primary" /></label>}
      <a href={directions} target="_blank" rel="noreferrer" onClick={() => { onDirections(); setLearningFeedback("Directions opened. This is a stronger signal for future maps."); }} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Navigation className="h-4 w-4" /> Directions</a>
    </aside>
  );
}
