"use client";

import { useState, useEffect } from "react";
import type { Place } from "@/lib/types/database";

interface PlaceSearchProps {
  cityId?: string;
  onSelect: (place: Place) => void;
}

export default function PlaceSearch({ cityId, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: query });
      if (cityId) params.set("city_id", cityId);

      const res = await fetch(`/api/places/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.places || []);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, cityId]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a place..."
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
      />
      {loading && <p className="mt-2 text-sm text-gray-500">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className="w-full rounded-lg p-3 text-left hover:bg-gray-50"
              >
                <p className="font-medium">{place.name}</p>
                <p className="text-sm text-gray-500">{place.address}</p>
                <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {place.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
