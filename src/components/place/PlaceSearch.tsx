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
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a place..."
          className="w-full rounded-full border border-cream-dark bg-white py-3 pl-10 pr-4 text-sm text-ink placeholder:text-ink-light/50 focus:border-ink focus:outline-none"
        />
      </div>
      {loading && <p className="mt-3 text-sm text-ink-light">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-3 space-y-1">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className="w-full rounded-xl p-3 text-left transition-colors hover:bg-cream-dark"
              >
                <p className="font-medium text-ink">{place.name}</p>
                <p className="text-sm text-ink-light">{place.address}</p>
                <span className="mt-0.5 inline-block rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light capitalize">
                  {place.category?.replace("_", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
