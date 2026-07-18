import type { Intent, TasteDimensionKey, TasteProfile, UserPlaceState } from "@/types/data";

const TASTE_KEY = "immersion:taste:v1";
const INTENT_KEY = "immersion:intent:v1";
const PLACE_KEY = "immersion:places:v1";

export interface UserStorage {
  getTasteProfile(): TasteProfile | null;
  setTasteProfile(profile: TasteProfile | null): void;
  getIntent(): Intent;
  setIntent(intent: Intent): void;
  getPlaces(): Record<string, UserPlaceState>;
  setPlaces(places: Record<string, UserPlaceState>): void;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export const localUserStorage: UserStorage = {
  getTasteProfile: () => migrateTasteProfile(readJson<TasteProfile | null>(TASTE_KEY, null)),
  setTasteProfile: (profile) => profile ? localStorage.setItem(TASTE_KEY, JSON.stringify(profile)) : localStorage.removeItem(TASTE_KEY),
  getIntent: () => readJson<Intent>(INTENT_KEY, "anything"),
  setIntent: (intent) => localStorage.setItem(INTENT_KEY, JSON.stringify(intent)),
  getPlaces: () => readJson<Record<string, UserPlaceState>>(PLACE_KEY, {}),
  setPlaces: (places) => localStorage.setItem(PLACE_KEY, JSON.stringify(places)),
};

function migrateTasteProfile(profile: TasteProfile | null): TasteProfile | null {
  if (!profile || profile.dimensions) return profile;
  const keys: TasteDimensionKey[] = ["energy", "novelty", "wandering", "formality", "neighborhoodOrientation"];
  return {
    ...profile,
    version: Math.max(profile.version ?? 1, 2),
    dimensions: Object.fromEntries(keys.map((key) => [key, {
      explicitValue: profile[key], learnedValue: 0, learnedConfidence: 0, effectiveValue: profile[key],
    }])) as TasteProfile["dimensions"],
    updatedAt: new Date().toISOString(),
  };
}
