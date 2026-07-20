import { useEffect, useState } from "react";

import { localUserStorage } from "@/lib/storage";
import { learnTaste, TASTE_DIMENSIONS } from "@/lib/tasteProfile";
import { learnTasteVector, migrateProfileToV3 } from "@/lib/tasteVector";
import type { RadarEvidence, TasteProfile, TasteSpace } from "@/types/data";

export function useTasteProfile(tasteSpace: TasteSpace | null) {
  const [tasteProfile, setTasteProfileState] = useState<TasteProfile | null>(() => localUserStorage.getTasteProfile());

  // Lazy migration: stored v2 profiles (and v3 profiles from a stale question
  // bank) upgrade once the taste space arrives. Until then — and forever on a
  // v4 dataset — the legacy 5-dim path keeps the map personalized.
  useEffect(() => {
    if (!tasteSpace) return;
    setTasteProfileState((current) => {
      if (!current) return current;
      const migrated = migrateProfileToV3(current, tasteSpace);
      if (!migrated) return current;
      localUserStorage.setTasteProfile(migrated);
      return migrated;
    });
  }, [tasteSpace]);

  const setTasteProfile = (profile: TasteProfile | null) => {
    const next = profile && tasteSpace ? migrateProfileToV3(profile, tasteSpace) ?? profile : profile;
    localUserStorage.setTasteProfile(next);
    setTasteProfileState(next);
  };

  const learnFromEvidence = (evidence: RadarEvidence, evidenceUnits: number, venueVec?: ArrayLike<number>) => {
    setTasteProfileState((current) => {
      if (!current) return current;
      const next = tasteSpace && current.vector && venueVec
        ? learnTasteVector(current, venueVec, evidenceUnits, tasteSpace)
        : learnTaste(
            current,
            Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, evidence.values[key] * 2 - 1])) as Record<(typeof TASTE_DIMENSIONS)[number], number>,
            evidenceUnits,
          );
      localUserStorage.setTasteProfile(next);
      return next;
    });
  };
  return { tasteProfile, setTasteProfile, learnFromEvidence };
}
