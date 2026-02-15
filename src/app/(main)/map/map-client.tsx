"use client";

import dynamic from "next/dynamic";
import type { Place } from "@/lib/types/database";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-cream">
      <p className="text-sm text-ink-light">Loading map...</p>
    </div>
  ),
});

interface MapClientProps {
  places: Place[];
  center: [number, number] | null;
}

export default function MapClient({ places, center }: MapClientProps) {
  if (places.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center bg-cream p-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-dark">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-ink-light">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
        <p className="font-medium text-ink">No places yet</p>
        <p className="mt-1 text-sm text-ink-light">
          Import your Google Maps saves or log a place to see it on the map.
        </p>
      </div>
    );
  }

  const mapCenter: [number, number] = center || [places[0].latitude, places[0].longitude];

  return (
    <MapView
      center={mapCenter}
      zoom={12}
      places={places}
      height="calc(100vh - 5rem)"
    />
  );
}
