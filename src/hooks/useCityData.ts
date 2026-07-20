import { useEffect, useState } from "react";

import { loadCategoryCurves, loadHexGeometry, loadManifest, loadMetricSlice, loadPlaceNeighbors, loadTasteSpace, loadVenues } from "@/lib/dataLoader";
import type {
  CategoryCurves,
  DatasetManifest,
  HexGeometryCollection,
  MetricSlice,
  PlaceNeighborIndex,
  TasteSpace,
  VenueRecord,
  WeekdayKey,
} from "@/types/data";

interface CityDataState {
  manifest: DatasetManifest | null;
  geometry: HexGeometryCollection | null;
  metrics: MetricSlice | null;
  venues: VenueRecord[];
  categoryCurves: CategoryCurves | null;
  placeNeighbors: PlaceNeighborIndex | null;
  tasteSpace: TasteSpace | null;
  progress: number;
  loadingLabel: string;
  error: string | null;
}

export function useCityData(day: WeekdayKey): CityDataState {
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);
  const [geometry, setGeometry] = useState<HexGeometryCollection | null>(null);
  const [metrics, setMetrics] = useState<MetricSlice | null>(null);
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [categoryCurves, setCategoryCurves] = useState<CategoryCurves | null>(null);
  const [placeNeighbors, setPlaceNeighbors] = useState<PlaceNeighborIndex | null>(null);
  const [tasteSpace, setTasteSpace] = useState<TasteSpace | null>(null);
  const [progress, setProgress] = useState(5);
  const [loadingLabel, setLoadingLabel] = useState("Reading dataset manifest");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function begin() {
      try {
        setError(null);
        const nextManifest = await loadManifest();
        if (cancelled) return;
        setManifest(nextManifest);
        setProgress(20);
        setLoadingLabel("Loading NYC geometry");
        const [nextGeometry, nextMetrics] = await Promise.all([
          loadHexGeometry(nextManifest),
          loadMetricSlice(nextManifest, day),
        ]);
        if (cancelled) return;
        setGeometry(nextGeometry);
        setMetrics(nextMetrics);
        setProgress(78);
        setLoadingLabel("Drawing the typical-week surface");

        window.setTimeout(() => {
          if (cancelled) return;
          Promise.all([loadVenues(nextManifest), loadCategoryCurves(nextManifest)])
            .then(async ([nextVenues, nextCurves]) => {
              if (cancelled) return;
              setVenues(nextVenues);
              setCategoryCurves(nextCurves);
              setProgress(100);
              setLoadingLabel("NYC map ready");
              // Retrieval index and taste space are opt-in weight for
              // venue-to-venue features and vector personalization; load them
              // after the map is usable and never let them block readiness.
              try {
                const nextNeighbors = await loadPlaceNeighbors(nextManifest, nextVenues);
                if (!cancelled) setPlaceNeighbors(nextNeighbors);
              } catch {
                /* retrieval stays unavailable; the map is already usable */
              }
              try {
                const nextTasteSpace = await loadTasteSpace(nextManifest, nextVenues);
                if (!cancelled) setTasteSpace(nextTasteSpace);
              } catch {
                /* taste stays on the legacy 5-dim path; the map is already usable */
              }
            })
            .catch(() => {
              if (!cancelled) {
                setProgress(100);
                setLoadingLabel("Map ready; venue layer unavailable");
              }
            });
        }, 0);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load NYC data");
      }
    }
    void begin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    setLoadingLabel(`Loading ${day.toUpperCase()} metrics`);
    loadMetricSlice(manifest, day)
      .then((nextMetrics) => {
        if (!cancelled) {
          setMetrics(nextMetrics);
          if (geometry) setLoadingLabel("NYC map ready");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load time metrics");
      });
    return () => {
      cancelled = true;
    };
  }, [day, geometry, manifest]);

  return { manifest, geometry, metrics, venues, categoryCurves, placeNeighbors, tasteSpace, progress, loadingLabel, error };
}
