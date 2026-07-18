import { useState } from "react";

import { localUserStorage } from "@/lib/storage";
import type { UserPlaceState } from "@/types/data";

export function useUserPlaceState() {
  const [places, setPlacesState] = useState<Record<string, UserPlaceState>>(() => localUserStorage.getPlaces());
  const updatePlace = (venueId: string, patch: Partial<UserPlaceState>) => {
    const current = places[venueId] ?? { venueId, saved: false, visited: false, endorsed: false, updatedAt: new Date().toISOString() };
    const next = { ...places, [venueId]: { ...current, ...patch, venueId, updatedAt: new Date().toISOString() } };
    localUserStorage.setPlaces(next);
    setPlacesState(next);
  };
  return { places, updatePlace };
}
