import { useState } from "react";

import { localUserStorage } from "@/lib/storage";
import { learnTaste, TASTE_DIMENSIONS } from "@/lib/tasteProfile";
import type { RadarEvidence, TasteProfile } from "@/types/data";

export function useTasteProfile() {
  const [tasteProfile, setTasteProfileState] = useState<TasteProfile | null>(() => localUserStorage.getTasteProfile());
  const setTasteProfile = (profile: TasteProfile | null) => {
    localUserStorage.setTasteProfile(profile);
    setTasteProfileState(profile);
  };
  const learnFromEvidence = (evidence: RadarEvidence, evidenceUnits: number) => {
    setTasteProfileState((current) => {
      if (!current) return current;
      const signals = Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, evidence.values[key] * 2 - 1])) as Record<(typeof TASTE_DIMENSIONS)[number], number>;
      const next = learnTaste(current, signals, evidenceUnits);
      localUserStorage.setTasteProfile(next);
      return next;
    });
  };
  return { tasteProfile, setTasteProfile, learnFromEvidence };
}
