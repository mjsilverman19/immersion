import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_CONFIG, PALETTE } from "@/lib/config";
import { buildBaseStyle } from "@/lib/mapStyle";
import { findAreaAtPoint } from "@/lib/mapAreaSelection";
import { mergeParallelStreetSegments, type StreetSegmentCandidate } from "@/lib/streetGeometry";
import { cn } from "@/lib/utils";
import type { HexGeometryCollection, MapMode, RankedVenue, SelectedArea, UserLocation, VenueRecord } from "@/types/data";

interface MapCanvasProps {
  geometry: HexGeometryCollection | null;
  areas: SelectedArea[];
  selectableAreas: SelectedArea[];
  selectedArea: SelectedArea | null;
  selectedVenues: RankedVenue[];
  mapMode: MapMode;
  userLocation: UserLocation | null;
  onSelectArea: (area: SelectedArea) => void;
  onSelectVenue: (venue: VenueRecord) => void;
  /** Venues surfaced by "more like this" / "continue from here" for the currently open place, drawn as a distinct layer. */
  retrievalVenues?: VenueRecord[];
  /** The venue open in the citywide (non-ranked) place sheet; drawn as a focus marker and panned to. */
  focusVenue?: VenueRecord | null;
  /** Clicking a retrieval dot on the map. */
  onSelectPlace?: (venue: VenueRecord) => void;
  className?: string;
}

const AREA_SOURCE = "recommendation-areas";
const AREA_HALO = "recommendation-area-halos";
const AREA_CORE = "recommendation-area-cores";
const AREA_LABEL = "recommendation-area-labels";
const ACTIVE_CELL_SOURCE = "active-area-cells";
const ACTIVE_CELL_GLOW = "active-area-cell-glow";
const ACTIVE_STREET_SOURCE = "active-street-segments";
const ACTIVE_STREET_GLOW = "active-street-glow";
const ACTIVE_STREETS = "active-streets";
const VENUE_SOURCE = "neighborhood-venues";
const VENUE_DOTS = "neighborhood-venue-dots";
const TOP_VENUE_DOTS = "top-venue-dots";
const TOP_VENUE_LABELS = "top-venue-labels";
const USER_SOURCE = "user-location";
const RETRIEVAL_SOURCE = "retrieval-venues";
const RETRIEVAL_DOTS = "retrieval-venue-dots";
const FOCUS_SOURCE = "place-focus";
const FOCUS_HALO = "place-focus-halo";
const FOCUS_CORE = "place-focus-core";

function runAfterStyleInit(map: maplibregl.Map, task: () => void): () => void {
  const attempt = () => {
    try {
      task();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Style is not done loading")) {
        map.once("style.load", attempt);
        return;
      }
      throw error;
    }
  };
  attempt();
  return () => map.off("style.load", attempt);
}

function areaGeoJson(areas: SelectedArea[], selectedId: string | null, mapMode: MapMode): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: areas.map((area, index) => ({
    type: "Feature", id: area.id,
    geometry: { type: "Point", coordinates: area.center },
    properties: {
      id: area.id,
      name: area.name,
      prominence: 1 - index * 0.2,
      selected: area.id === selectedId ? 1 : 0,
      personalized: mapMode === "personalized" ? 1 : 0,
      glowStrength: area.glowStrength,
      glowBasis: area.glowBasis,
    },
  })) };
}

function venueGeoJson(venues: RankedVenue[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: venues.map((ranked) => ({
    type: "Feature", id: ranked.venue.id,
    geometry: { type: "Point", coordinates: [ranked.venue.longitude, ranked.venue.latitude] },
    properties: {
      id: ranked.venue.id, name: ranked.venue.name, rank: ranked.rank,
      score: ranked.score, timeFit: ranked.timeFit,
      isRecommended: ranked.isRecommended ? 1 : 0,
      recommendationLabel: ranked.recommendationLabel,
    },
  })) };
}

function placePointGeoJson(venues: VenueRecord[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: venues.map((venue) => ({
    type: "Feature", id: venue.id,
    geometry: { type: "Point", coordinates: [venue.longitude, venue.latitude] },
    properties: { id: venue.id, name: venue.name },
  })) };
}

function activeCellGeoJson(geometry: HexGeometryCollection | null, selectedArea: SelectedArea | null, areas: SelectedArea[]): GeoJSON.FeatureCollection {
  const displayedAreas = selectedArea ? [selectedArea] : areas;
  const cells = new Map(displayedAreas.flatMap((area) => area.activeCells).map((cell) => [cell.h3, cell]));
  return {
    type: "FeatureCollection",
    features: (geometry?.features ?? []).filter((feature) => cells.has(feature.properties.h3)).map((feature) => ({
      ...feature,
      properties: { ...feature.properties, activityScore: cells.get(feature.properties.h3)?.score ?? 0 },
    })) as GeoJSON.Feature[],
  };
}

interface CellShape {
  h3: string;
  score: number;
  confidence: number;
  ring: number[][];
  bounds: [number, number, number, number];
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function cellShapes(geometry: HexGeometryCollection | null, selectedArea: SelectedArea | null): CellShape[] {
  const scores = new Map((selectedArea?.activeCells ?? []).map((cell) => [cell.h3, cell]));
  return (geometry?.features ?? []).flatMap((feature) => {
    const cell = scores.get(feature.properties.h3);
    if (!cell) return [];
    const ring = feature.geometry.coordinates[0];
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    return [{ h3: cell.h3, score: cell.score, confidence: cell.confidence, ring, bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }];
  });
}

function splitStreetSegments(features: maplibregl.MapGeoJSONFeature[], cells: CellShape[]): GeoJSON.FeatureCollection {
  const candidates: StreetSegmentCandidate[] = [];
  const seen = new Set<string>();
  const addLine = (coordinates: number[][], roadClass: unknown) => {
    for (let index = 1; index < coordinates.length; index += 1) {
      const start = coordinates[index - 1];
      const end = coordinates[index];
      const midpoint: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const cell = cells.find((candidate) => midpoint[0] >= candidate.bounds[0] && midpoint[0] <= candidate.bounds[2] && midpoint[1] >= candidate.bounds[1] && midpoint[1] <= candidate.bounds[3] && pointInRing(midpoint, candidate.ring));
      if (!cell || cell.confidence < 0.2 || cell.score < 0.08) continue;
      const a = `${start[0].toFixed(5)},${start[1].toFixed(5)}`;
      const b = `${end[0].toFixed(5)},${end[1].toFixed(5)}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ start, end, strength: cell.score, confidence: cell.confidence, roadClass, mergedCount: 1 });
    }
  };
  features.forEach((feature) => {
    if (feature.geometry.type === "LineString") addLine(feature.geometry.coordinates, feature.properties.class);
    if (feature.geometry.type === "MultiLineString") feature.geometry.coordinates.forEach((line) => addLine(line, feature.properties.class));
  });
  const output = mergeParallelStreetSegments(candidates).map((segment): GeoJSON.Feature => ({
    type: "Feature",
    geometry: { type: "LineString", coordinates: [segment.start, segment.end] },
    properties: { strength: segment.strength, confidence: segment.confidence, roadClass: segment.roadClass },
  }));
  return { type: "FeatureCollection", features: output };
}

export function MapCanvas({ geometry, areas, selectableAreas, selectedArea, selectedVenues, mapMode, userLocation, onSelectArea, onSelectVenue, retrievalVenues = [], focusVenue = null, onSelectPlace, className }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const areasRef = useRef(areas);
  const selectedAreaRef = useRef(selectedArea);
  const autoActivationPendingRef = useRef<string | null>(null);
  const venuesRef = useRef(selectedVenues);
  const retrievalVenuesRef = useRef(retrievalVenues);
  const onSelectAreaRef = useRef(onSelectArea);
  const onSelectVenueRef = useRef(onSelectVenue);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const [ready, setReady] = useState(false);
  const [streetSegmentCount, setStreetSegmentCount] = useState(0);
  const [visibleVenueCount, setVisibleVenueCount] = useState(0);
  const [detailZoom, setDetailZoom] = useState(11.35);
  areasRef.current = areas;
  selectedAreaRef.current = selectedArea;
  venuesRef.current = selectedVenues;
  retrievalVenuesRef.current = retrievalVenues;
  onSelectAreaRef.current = onSelectArea;
  onSelectVenueRef.current = onSelectVenue;
  onSelectPlaceRef.current = onSelectPlace;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setReady(false);
    const map = new maplibregl.Map({
      container: containerRef.current, style: buildBaseStyle(),
      center: [MAP_CONFIG.center.lng, MAP_CONFIG.center.lat], zoom: 11.35,
      minZoom: MAP_CONFIG.minZoom, maxZoom: MAP_CONFIG.maxZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    map.once("load", () => setReady(true));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      const data = areaGeoJson(areas, selectedArea?.id ?? null, mapMode);
      const source = map.getSource(AREA_SOURCE) as GeoJSONSource | undefined;
      if (source) { source.setData(data); return; }
      map.addSource(AREA_SOURCE, { type: "geojson", data, promoteId: "id" });
      map.addLayer({ id: AREA_HALO, type: "circle", source: AREA_SOURCE, paint: {
      "circle-color": PALETTE.rust,
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        10, ["interpolate", ["linear"], ["get", "glowStrength"], 0, 20, 0.5, 42, 1, 68],
        12, ["interpolate", ["linear"], ["get", "glowStrength"], 0, 32, 0.5, 72, 1, 108],
        14, ["interpolate", ["linear"], ["get", "glowStrength"], 0, 44, 0.5, 96, 1, 132],
      ],
      "circle-opacity": ["case", ["==", ["get", "selected"], 1],
        ["interpolate", ["linear"], ["get", "glowStrength"], 0, 0.02, 0.5, 0.065, 1, 0.12],
        ["interpolate", ["linear"], ["get", "glowStrength"], 0, 0.08, 0.4, 0.2, 0.75, 0.34, 1, 0.46],
      ],
      "circle-blur": ["case", ["==", ["get", "selected"], 1], 0.86, ["interpolate", ["linear"], ["get", "glowStrength"], 0, 0.82, 1, 0.68]],
      } });
      map.addLayer({ id: AREA_CORE, type: "circle", source: AREA_SOURCE, paint: {
      "circle-color": PALETTE.cream,
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 10, 7],
      "circle-stroke-color": PALETTE.rust,
      "circle-stroke-width": ["+", ["case", ["==", ["get", "selected"], 1], 2.5, 1.5], ["*", ["get", "glowStrength"], 1.5]],
      "circle-opacity": 0.95,
      } });
      map.addLayer({ id: AREA_LABEL, type: "symbol", source: AREA_SOURCE, layout: {
      "text-field": ["get", "name"], "text-font": ["Noto Serif Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 14, 16],
      "text-offset": [0, 1.2], "text-anchor": "top", "text-allow-overlap": false,
      }, paint: { "text-color": PALETTE.ink, "text-halo-color": PALETTE.cream, "text-halo-width": 1.5 } });
      for (const layer of [AREA_HALO, AREA_CORE, AREA_LABEL]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, (event) => {
          const id = event.features?.[0]?.properties?.id as string | undefined;
          const area = areasRef.current.find((item) => item.id === id);
          if (area) onSelectAreaRef.current(area);
        });
      }
    };
    return runAfterStyleInit(map, apply);
  }, [areas, mapMode, ready, selectedArea?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const activateAreaAtCenter = () => {
      if (map.getZoom() < 12.8 || autoActivationPendingRef.current) return;
      const center = map.getCenter();
      const area = findAreaAtPoint(geometry, selectableAreas, [center.lng, center.lat]);
      if (!area || selectedAreaRef.current?.id === area.id) return;
      autoActivationPendingRef.current = area.id;
      onSelectAreaRef.current(area);
    };
    map.on("zoomend", activateAreaAtCenter);
    map.on("moveend", activateAreaAtCenter);
    activateAreaAtCenter();
    return () => {
      map.off("zoomend", activateAreaAtCenter);
      map.off("moveend", activateAreaAtCenter);
    };
  }, [geometry, ready, selectableAreas]);

  useEffect(() => {
    autoActivationPendingRef.current = null;
  }, [selectedArea?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedArea && map.getZoom() < 13.35) map.jumpTo({ center: selectedArea.center, zoom: 13.35 });
    const data = activeCellGeoJson(geometry, selectedArea, areas);
    const cells = cellShapes(geometry, selectedArea);
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    let rebuild: (() => void) | null = null;
    const setup = () => {
      const source = map.getSource(ACTIVE_CELL_SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource(ACTIVE_CELL_SOURCE, { type: "geojson", data });
        map.addLayer({ id: ACTIVE_CELL_GLOW, type: "fill", source: ACTIVE_CELL_SOURCE, minzoom: 10.4, paint: {
          "fill-color": PALETTE.rust,
          "fill-opacity": ["interpolate", ["linear"], ["get", "activityScore"], 0, 0, 0.35, 0.012, 0.7, 0.04, 1, 0.075],
        } });
      }
      const streetSource = map.getSource(ACTIVE_STREET_SOURCE) as GeoJSONSource | undefined;
      if (!streetSource) map.addSource(ACTIVE_STREET_SOURCE, { type: "geojson", data: empty });
      if (!map.getLayer(ACTIVE_STREET_GLOW)) {
        map.addLayer({ id: ACTIVE_STREET_GLOW, type: "line", source: ACTIVE_STREET_SOURCE, minzoom: 12.8, layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": PALETTE.rust,
          "line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0, 0, 0.4, 0.09, 0.7, 0.28, 1, 0.5],
          "line-blur": 4,
          "line-width": ["interpolate", ["linear"], ["get", "strength"], 0, 1.2, 0.5, 3.8, 0.75, 7, 1, 10],
        } });
        map.addLayer({ id: ACTIVE_STREETS, type: "line", source: ACTIVE_STREET_SOURCE, minzoom: 12.8, layout: { "line-cap": "round", "line-join": "round" }, paint: {
          "line-color": "#A84B35",
          "line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0, 0.04, 0.35, 0.14, 0.65, 0.48, 1, 0.82],
          "line-width": ["interpolate", ["linear"], ["get", "strength"], 0, 0.3, 0.45, 0.95, 0.75, 1.9, 1, 3],
        } });
      }
      rebuild = () => {
        const target = map.getSource(ACTIVE_STREET_SOURCE) as GeoJSONSource | undefined;
        setDetailZoom(map.getZoom());
        if (!target || !selectedArea || map.getZoom() < 12.8 || !cells.length) { target?.setData(empty); setStreetSegmentCount(0); return; }
        const roads = map.queryRenderedFeatures({ layers: ["roads"] });
        const segments = splitStreetSegments(roads, cells);
        target.setData(segments);
        setStreetSegmentCount(segments.features.length);
      };
      rebuild();
      map.once("idle", rebuild);
      map.on("moveend", rebuild);
      map.on("zoomend", rebuild);
    };
    const cancelStyleRetry = runAfterStyleInit(map, setup);
    return () => {
      cancelStyleRetry();
      if (rebuild) {
        map.off("idle", rebuild);
        map.off("moveend", rebuild);
        map.off("zoomend", rebuild);
      }
    };
  }, [areas, geometry, ready, selectedArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = venueGeoJson(selectedVenues);
    const audit = () => {
      if (!map.getLayer(VENUE_DOTS)) { setVisibleVenueCount(0); return; }
      setVisibleVenueCount(map.queryRenderedFeatures({ layers: [VENUE_DOTS, TOP_VENUE_DOTS] }).length);
    };
    const apply = () => {
      const source = map.getSource(VENUE_SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(VENUE_SOURCE, { type: "geojson", data, promoteId: "id" });
      const shouldAttachHandlers = !map.getLayer(VENUE_DOTS);
      if (!map.getLayer(VENUE_DOTS)) map.addLayer({ id: VENUE_DOTS, type: "circle", source: VENUE_SOURCE, minzoom: 12.8, filter: [">", ["get", "rank"], 5], paint: {
        "circle-color": PALETTE.rust,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.8, 2.3, 16, 4],
        "circle-opacity": ["interpolate", ["linear"], ["get", "timeFit"], 0, 0.18, 0.5, 0.48, 1, 0.82],
        "circle-stroke-color": PALETTE.cream, "circle-stroke-width": 0.8,
      } });
      if (!map.getLayer(TOP_VENUE_DOTS)) map.addLayer({ id: TOP_VENUE_DOTS, type: "circle", source: VENUE_SOURCE, minzoom: 12.5, filter: ["<=", ["get", "rank"], 5], paint: {
        "circle-color": PALETTE.rust, "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.5, 9, 16, 12],
        "circle-opacity": 0.98, "circle-stroke-color": PALETTE.cream, "circle-stroke-width": 2,
      } });
      if (!map.getLayer(TOP_VENUE_LABELS)) map.addLayer({ id: TOP_VENUE_LABELS, type: "symbol", source: VENUE_SOURCE, minzoom: 13.4, filter: ["<=", ["get", "rank"], 5], layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Serif Regular"], "text-size": 11, "text-offset": [1.25, 0], "text-anchor": "left",
        "text-optional": true, "text-padding": 8,
      }, paint: { "text-color": PALETTE.ink, "text-halo-color": PALETTE.cream, "text-halo-width": 2 } });
      const interactiveLayers = [VENUE_DOTS, TOP_VENUE_DOTS, TOP_VENUE_LABELS];
      if (!shouldAttachHandlers) return;
      interactiveLayers.forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        map.on("click", layer, (event) => {
          const id = event.features?.[0]?.properties?.id as string | undefined;
          const venue = venuesRef.current.find((item) => item.venue.id === id)?.venue;
          if (venue) onSelectVenueRef.current(venue);
        });
      });
    };
    const cancelStyleRetry = runAfterStyleInit(map, apply);
    map.once("idle", audit);
    return () => { cancelStyleRetry(); map.off("idle", audit); };
  }, [ready, selectedVenues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: userLocation ? [{ type: "Feature", geometry: { type: "Point", coordinates: [userLocation.longitude, userLocation.latitude] }, properties: {} }] : [] };
    const apply = () => {
      const source = map.getSource(USER_SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource(USER_SOURCE, { type: "geojson", data });
        map.addLayer({ id: "user-location-halo", type: "circle", source: USER_SOURCE, paint: { "circle-radius": 12, "circle-color": PALETTE.rust, "circle-opacity": 0.18 } });
        map.addLayer({ id: "user-location-dot", type: "circle", source: USER_SOURCE, paint: { "circle-radius": 5, "circle-color": PALETTE.rust, "circle-stroke-color": PALETTE.cream, "circle-stroke-width": 2 } });
      }
      if (userLocation) map.easeTo({ center: [userLocation.longitude, userLocation.latitude], zoom: Math.max(12, map.getZoom()), duration: 600 });
    };
    return runAfterStyleInit(map, apply);
  }, [ready, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = placePointGeoJson(retrievalVenues);
    const apply = () => {
      const source = map.getSource(RETRIEVAL_SOURCE) as GeoJSONSource | undefined;
      if (source) { source.setData(data); return; }
      map.addSource(RETRIEVAL_SOURCE, { type: "geojson", data, promoteId: "id" });
      map.addLayer({ id: RETRIEVAL_DOTS, type: "circle", source: RETRIEVAL_SOURCE, paint: {
        "circle-color": PALETTE.indigo,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 8],
        "circle-opacity": 0.85,
        "circle-stroke-color": PALETTE.cream, "circle-stroke-width": 1.5,
      } });
      map.on("mouseenter", RETRIEVAL_DOTS, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", RETRIEVAL_DOTS, () => { map.getCanvas().style.cursor = ""; });
      map.on("click", RETRIEVAL_DOTS, (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        const venue = retrievalVenuesRef.current.find((item) => item.id === id);
        if (venue) onSelectPlaceRef.current?.(venue);
      });
    };
    return runAfterStyleInit(map, apply);
  }, [ready, retrievalVenues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = placePointGeoJson(focusVenue ? [focusVenue] : []);
    const apply = () => {
      const source = map.getSource(FOCUS_SOURCE) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource(FOCUS_SOURCE, { type: "geojson", data });
        map.addLayer({ id: FOCUS_HALO, type: "circle", source: FOCUS_SOURCE, paint: { "circle-radius": 22, "circle-color": PALETTE.rust, "circle-opacity": 0.16, "circle-blur": 0.8 } });
        map.addLayer({ id: FOCUS_CORE, type: "circle", source: FOCUS_SOURCE, paint: { "circle-radius": 8, "circle-color": PALETTE.cream, "circle-stroke-color": PALETTE.rust, "circle-stroke-width": 3 } });
      }
      if (focusVenue && map.getZoom() < 13.5) {
        map.easeTo({ center: [focusVenue.longitude, focusVenue.latitude], zoom: 14, duration: 600 });
      }
    };
    return runAfterStyleInit(map, apply);
  }, [focusVenue, ready]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} aria-label="Interactive NYC recommendation map"><span className="sr-only" role="status">{selectedArea ? `${selectedVenues.length} places, ${selectedArea.recommendedVenues.length} emphasized recommendations, ${visibleVenueCount} currently visible place markers, and ${streetSegmentCount} typical activity street segments shown in ${selectedArea.name} at zoom ${detailZoom.toFixed(1)}` : "City recommendations shown"}</span></div>;
}
