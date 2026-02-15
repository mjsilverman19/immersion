"use client";

import { useState, useEffect, useCallback } from "react";
import RecommendedPlaceCard from "@/components/place/RecommendedPlaceCard";
import CategoryFilter from "./CategoryFilter";
import TastePrompt from "./TastePrompt";

interface RecommendedPlace {
  id: string;
  name: string;
  address: string | null;
  category: string;
  photo_urls: string[] | null;
  score: number;
  match_level: "strong" | "good" | "moderate" | null;
  top_vibe_tags: string[];
  attribution: string | null;
  log_count: number;
  avg_rating: number;
}

interface RecommendedForYouProps {
  cityId: string;
  hasTastePreferences: boolean;
}

export default function RecommendedForYou({
  cityId,
  hasTastePreferences: initialHasTastePreferences,
}: RecommendedForYouProps) {
  const [places, setPlaces] = useState<RecommendedPlace[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [hasAnyPlaces, setHasAnyPlaces] = useState(false);
  const [hasTastePreferences, setHasTastePreferences] = useState(
    initialHasTastePreferences
  );

  const fetchRecs = useCallback(async (cat: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city_id: cityId });
      if (cat) params.set("category", cat);
      const res = await fetch(`/api/discover/places?${params}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedPlaces = data.places || [];
        setPlaces(fetchedPlaces);
        setMode(data.mode || null);
        if (fetchedPlaces.length > 0) setHasAnyPlaces(true);
      }
    } catch {
      // Silently fail — section just won't show
    }
    setLoading(false);
  }, [cityId]);

  useEffect(() => {
    fetchRecs(category);
  }, [fetchRecs, category]);

  const handleCategoryChange = (cat: string | null) => {
    setCategory(cat);
  };

  const handleTasteSaved = () => {
    setHasTastePreferences(true);
    fetchRecs(category);
  };

  // Hide section entirely only if the initial unfiltered fetch returned nothing
  if (!loading && !hasAnyPlaces && places.length === 0) return null;

  return (
    <div className="px-4 pb-6">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
        Recommended for You
      </h2>

      {/* Taste prompt for users without preferences in quality mode */}
      {!hasTastePreferences && mode === "quality" && !loading && (
        <div className="mb-4">
          <TastePrompt onSaved={handleTasteSaved} />
        </div>
      )}

      {/* Category filter pills */}
      <div className="mb-3">
        <CategoryFilter selected={category} onChange={handleCategoryChange} />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-56 flex-shrink-0 animate-pulse rounded-xl bg-white shadow-sm"
            >
              <div className="h-32 rounded-t-xl bg-cream-dark" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-cream-dark" />
                <div className="flex gap-1">
                  <div className="h-4 w-16 rounded-full bg-cream-dark" />
                  <div className="h-4 w-12 rounded-full bg-cream-dark" />
                </div>
                <div className="h-3 w-1/2 rounded bg-cream-dark" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && places.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {places.map((place) => (
            <RecommendedPlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

      {/* Empty state for filtered category */}
      {!loading && places.length === 0 && hasAnyPlaces && (
        <p className="text-sm text-ink-light">No places in this category yet</p>
      )}
    </div>
  );
}
