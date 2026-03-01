"use client";

import { useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPin {
  lat: number;
  lng: number;
  type: "logged" | "saved";
  placeId?: string;
  name?: string;
  rating?: number;
  vibeTag?: string;
}

interface ProfileMapProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  sourceUserId?: string;
  savedPlaceIds?: string[];
  height?: number;
}

const INDIGO = "#6B6E8A";
const INK = "#1A1A1A";
const WHITE = "#FFFFFF";

function createHeartPinIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${INDIGO}" stroke="${WHITE}" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    className: "",
  });
}

function createBookmarkPinIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18" viewBox="0 0 16 22">
    <path d="M3 1h10a2 2 0 012 2v16.5l-6-3.5L3 19.5V3a2 2 0 010-4z" fill="${INK}" stroke="${WHITE}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [14, 18],
    iconAnchor: [7, 18],
    className: "",
  });
}

function popupHeartsHtml(rating: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < rating;
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="${filled ? INDIGO : "none"}" stroke="${filled ? INDIGO : "#F0ECE6"}" stroke-width="${filled ? 0 : 2}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }).join("");
}

export default function ProfileMap({
  pins,
  center,
  zoom = 13,
  interactive = false,
  sourceUserId,
  savedPlaceIds = [],
  height = 200,
}: ProfileMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const savedSetRef = useRef(new Set(savedPlaceIds));

  // Fallback center if no pins
  const fallbackCenter: [number, number] = center || [40.7128, -74.006];

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: fallbackCenter,
      zoom,
      zoomControl: false,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: interactive,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    ).addTo(map);

    // Apply warm desaturated filter
    const tilePane = mapRef.current.querySelector(
      ".leaflet-tile-pane"
    ) as HTMLElement;
    if (tilePane) {
      tilePane.style.filter =
        "saturate(0.3) sepia(0.25) brightness(1.05) contrast(0.95)";
    }

    const heartIcon = createHeartPinIcon();
    const bookmarkIcon = createBookmarkPinIcon();

    pins.forEach((pin) => {
      const icon = pin.type === "logged" ? heartIcon : bookmarkIcon;
      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        interactive: interactive && pin.type === "logged",
      }).addTo(map);

      // Add popup for interactive mode
      if (interactive && pin.placeId && pin.name !== undefined) {
        const isSaved = savedSetRef.current.has(pin.placeId);
        const popupContent = `
          <div style="min-width: 170px; padding: 2px;">
            <div style="font-family: Georgia, serif; font-size: 15px; font-weight: 500; color: ${INK};">${pin.name}</div>
            <div style="display: flex; gap: 2px; margin-top: 4px; align-items: center;">
              ${popupHeartsHtml(pin.rating || 0)}
            </div>
            ${pin.vibeTag ? `<div style="font-size: 12px; color: ${INDIGO}; margin-top: 4px;">${pin.vibeTag}</div>` : ""}
            <button
              data-place-id="${pin.placeId}"
              class="popup-save-btn"
              ${isSaved ? "disabled" : ""}
              style="margin-top: 8px; padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; cursor: ${isSaved ? "default" : "pointer"}; ${
                isSaved
                  ? `background: ${INDIGO}; color: ${WHITE}; border: 1px solid ${INDIGO};`
                  : `background: ${WHITE}; color: ${INDIGO}; border: 1px solid rgba(107,110,138,0.3);`
              }"
            >${isSaved ? "Saved" : "Save"}</button>
          </div>
        `;
        marker.bindPopup(popupContent, {
          closeButton: false,
          className: "profile-map-popup",
        });
      }
    });

    // Fit map to show all pins
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Event delegation for popup save buttons
  useEffect(() => {
    if (!interactive || !mapRef.current) return;

    const handler = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(
        ".popup-save-btn"
      ) as HTMLButtonElement;
      if (!btn || btn.disabled) return;

      const placeId = btn.dataset.placeId;
      if (!placeId) return;

      btn.disabled = true;
      btn.textContent = "Saving...";

      const res = await fetch("/api/place-saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: placeId,
          source_user_id: sourceUserId,
        }),
      });

      if (res.ok) {
        btn.textContent = "Saved";
        btn.style.backgroundColor = INDIGO;
        btn.style.color = WHITE;
        btn.style.borderColor = INDIGO;
        btn.style.cursor = "default";
        savedSetRef.current.add(placeId);
      } else {
        btn.disabled = false;
        btn.textContent = "Save";
      }
    };

    const container = mapRef.current;
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [interactive, sourceUserId]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden isolate"
      style={{ height: `${height}px` }}
    />
  );
}
