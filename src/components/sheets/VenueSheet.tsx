import { PlaceDetailSheet } from "@/components/sheets/PlaceDetailSheet";
import type { ComplementResult, RankedVenue, SimilarResult, TasteProfile, UserPlaceState } from "@/types/data";

interface VenueSheetProps {
  ranked: RankedVenue | null;
  tasteProfile: TasteProfile | null;
  state: UserPlaceState | undefined;
  onUpdate: (patch: Partial<UserPlaceState>) => void;
  onViewOnMaps: () => void;
  onShapeTaste: () => void;
  onClose: () => void;
  similar?: SimilarResult[];
  complements?: ComplementResult[];
  onSelectPlace: (id: string) => void;
}

export function VenueSheet({ ranked, tasteProfile, state, onUpdate, onViewOnMaps, onShapeTaste, onClose, similar = [], complements = [], onSelectPlace }: VenueSheetProps) {
  if (!ranked) return null;
  return (
    <PlaceDetailSheet
      venue={ranked.venue}
      contextLabel="A place for your map"
      tasteProfile={tasteProfile}
      evidence={ranked.radarEvidence}
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
