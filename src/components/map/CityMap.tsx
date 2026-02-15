"use client";

import dynamic from "next/dynamic";
import type { Place } from "@/lib/types/database";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-xl bg-gray-100">
      <p className="text-sm text-gray-400">Loading map...</p>
    </div>
  ),
});

interface CityMapProps {
  center: [number, number];
  places: Place[];
}

export default function CityMap({ center, places }: CityMapProps) {
  if (places.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl">
      <MapView center={center} zoom={13} places={places} height="300px" />
    </div>
  );
}
