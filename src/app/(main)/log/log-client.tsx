"use client";

import { useState } from "react";
import PlaceSearch from "@/components/place/PlaceSearch";
import LogForm from "@/components/place/LogForm";
import type { Place } from "@/lib/types/database";

export default function LogClient() {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSelect = async (place: Place) => {
    const ext = place as Place & { _isGoogle?: boolean };
    if (ext._isGoogle && place.google_place_id) {
      // Create the place in our DB first
      setCreating(true);
      try {
        const res = await fetch("/api/places/create-from-google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ google_place_id: place.google_place_id }),
        });

        if (res.ok) {
          const data = await res.json();
          setSelectedPlace(data.place);
        } else {
          console.error("Failed to create place from Google");
        }
      } catch (err) {
        console.error("Error creating place:", err);
      } finally {
        setCreating(false);
      }
    } else {
      setSelectedPlace(place);
    }
  };

  if (creating) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-ink-light">Adding place...</p>
      </div>
    );
  }

  if (selectedPlace) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedPlace(null)}
          className="mb-4 flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to search
        </button>
        <LogForm place={selectedPlace} />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ink-light">
        Search for a restaurant, cafe, bar, or any place you want to log.
      </p>
      <PlaceSearch onSelect={handleSelect} />
    </div>
  );
}
