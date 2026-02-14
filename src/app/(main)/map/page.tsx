"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import type { Place } from "@/lib/types/database";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-sm text-gray-400">Loading map...</p>
    </div>
  ),
});

export default function GlobalMapPage() {
  const { user, profile } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchPlaces = useCallback(async () => {
    if (!user) return;

    const placeMap = new Map<string, Place>();

    // Fetch places the user has logged
    const { data: logs } = await supabase
      .from("logs")
      .select("*, places!logs_place_id_fkey(id, name, city_id, address, latitude, longitude, category, subcategory, photo_urls, google_maps_url, google_place_id, created_at)")
      .eq("user_id", user.id);

    if (logs) {
      for (const log of logs) {
        const place = (log as Record<string, unknown>).places as Place | null;
        if (place?.id) placeMap.set(place.id, place);
      }
    }

    // Fetch places from the user's lists
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .eq("user_id", user.id);

    if (lists && lists.length > 0) {
      const listIds = lists.map((l) => l.id);
      const { data: listItems } = await supabase
        .from("list_items")
        .select("*, places!list_items_place_id_fkey(id, name, city_id, address, latitude, longitude, category, subcategory, photo_urls, google_maps_url, google_place_id, created_at)")
        .in("list_id", listIds);

      if (listItems) {
        for (const item of listItems) {
          const place = (item as Record<string, unknown>).places as Place | null;
          if (place?.id) placeMap.set(place.id, place);
        }
      }
    }

    setPlaces(Array.from(placeMap.values()));
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  if (loading && places.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-sm text-gray-400">Loading your places...</p>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center p-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
        <p className="font-medium dark:text-white">No places yet</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Import your Google Maps saves or log a place to see it on the map.
        </p>
      </div>
    );
  }

  // Center on home city or first place
  const defaultCenter: [number, number] = profile?.city
    ? [
        (profile.city as { latitude: number }).latitude,
        (profile.city as { longitude: number }).longitude,
      ]
    : [places[0].latitude, places[0].longitude];

  return (
    <MapView
      center={defaultCenter}
      zoom={12}
      places={places}
      height="calc(100vh - 5rem)"
    />
  );
}
