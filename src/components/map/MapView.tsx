"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { Place } from "@/lib/types/database";

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: "#ef4444",
  cafe: "#92400e",
  bar: "#7c3aed",
  park: "#16a34a",
  shop: "#2563eb",
  viewpoint: "#ea580c",
  experience: "#6b7280",
};

function createMarkerIcon(category: string) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.experience;
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

interface MapViewProps {
  center: [number, number];
  zoom: number;
  places: Place[];
  height?: string;
}

function FitBounds({ places }: { places: Place[] }) {
  const map = useMap();

  useEffect(() => {
    if (places.length === 0) return;

    if (places.length === 1) {
      map.setView([places[0].latitude, places[0].longitude], 14);
      return;
    }

    const bounds = L.latLngBounds(
      places.map((p) => [p.latitude, p.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, places]);

  return null;
}

export default function MapView({
  center,
  zoom,
  places,
  height = "300px",
}: MapViewProps) {
  return (
    <div style={{ height, width: "100%" }} className="relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds places={places} />
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={createMarkerIcon(place.category)}
          >
            <Popup>
              <div className="min-w-[160px]">
                <Link
                  href={`/place/${place.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {place.name}
                </Link>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[place.category] ||
                        CATEGORY_COLORS.experience,
                    }}
                  />
                  <span className="text-xs text-gray-500 capitalize">
                    {place.category}
                  </span>
                </div>
                {place.address && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                    {place.address}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
