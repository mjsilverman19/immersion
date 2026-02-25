"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface CityMapHeroInnerProps {
  center: [number, number];
  places: { latitude: number; longitude: number }[];
}

export default function CityMapHeroInner({ center, places }: CityMapHeroInnerProps) {
  return (
    <div className="relative h-[180px] w-full overflow-hidden">
      <div
        className="h-full w-full"
        style={{ filter: "saturate(0.3) brightness(1.05)" }}
      >
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          doubleClickZoom={false}
          touchZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {places.map((place, i) => (
            <CircleMarker
              key={i}
              center={[place.latitude, place.longitude]}
              radius={4}
              pathOptions={{
                fillColor: "#6B6B6B",
                fillOpacity: 0.7,
                color: "#FFFFFF",
                weight: 1.5,
                opacity: 0.9,
              }}
            />
          ))}
        </MapContainer>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-cream to-transparent" />
    </div>
  );
}
