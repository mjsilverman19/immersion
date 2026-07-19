import { PlaceDetailSheet } from "@/components/sheets/PlaceDetailSheet";
import { standaloneRadarEvidence } from "@/lib/recommendations";
import type { ComplementResult, SimilarResult, TasteProfile, UserPlaceState, VenueRecord } from "@/types/data";

interface PlaceSheetProps {
  venue: VenueRecord | null;
  tasteProfile: TasteProfile | null;
  state: UserPlaceState | undefined;
  onUpdate: (patch: Partial<UserPlaceState>) => void;
  onViewOnMaps: () => void;
  onShapeTaste: () => void;
  onClose: () => void;
  similar: SimilarResult[];
  complements: ComplementResult[];
  onSelectPlace: (id: string) => void;
}

/**
 * Venue detail for places reached through retrieval ("more like this" /
 * "continue from here") rather than the current area's ranking — often a
 * different neighborhood, or a category the active intent doesn't rank.
 */
export function PlaceSheet({ venue, tasteProfile, state, onUpdate, onViewOnMaps, onShapeTaste, onClose, similar, complements, onSelectPlace }: PlaceSheetProps) {
  if (!venue) return null;
  return (
    <PlaceDetailSheet
      venue={venue}
      contextLabel="Explore this place"
      tasteProfile={tasteProfile}
      evidence={standaloneRadarEvidence(venue)}
      state={state}
      onUpdate={onUpdate}
      onViewOnMaps={onViewOnMaps}
      onShapeTaste={onShapeTaste}
      onClose={onClose}
      similar={similar}
      complements={complements}
      onSelectPlace={onSelectPlace}
    />
  );
}
