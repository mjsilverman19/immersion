import { decodeTasteSpace } from "@/lib/tasteSpace";
import type {
  CompactMetricSlice,
  CategoryCurves,
  DatasetManifest,
  HexDayRecord,
  ComplementFactor,
  HexGeometryCollection,
  MetricSlice,
  PlaceNeighborIndex,
  PlaceNeighborsArtifact,
  SimilarChannel,
  TasteSpace,
  TasteSpaceArtifact,
  VenueRecord,
  WeekdayKey,
} from "@/types/data";

const DATA_ROOT = `${import.meta.env.BASE_URL}data/nyc/`;
const dayCache = new Map<WeekdayKey, Promise<MetricSlice>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json() as Promise<T>;
}

export const cityDataUrl = (filename: string) => `${DATA_ROOT}${filename}`;

export async function loadManifest(): Promise<DatasetManifest> {
  const manifest = await fetchJson<DatasetManifest>(cityDataUrl("manifest.json"));
  // v4 datasets are still valid — they simply carry no taste-space artifact,
  // so the app runs the legacy 5-dim taste path.
  if (![4, 5].includes(manifest.schemaVersion) || manifest.city !== "nyc") {
    throw new Error(`Unsupported NYC dataset schema ${manifest.schemaVersion}`);
  }
  return manifest;
}

export function loadHexGeometry(manifest: DatasetManifest): Promise<HexGeometryCollection> {
  return fetchJson<HexGeometryCollection>(cityDataUrl(manifest.files.hexes));
}

export function loadMetricSlice(
  manifest: DatasetManifest,
  day: WeekdayKey,
): Promise<MetricSlice> {
  const cached = dayCache.get(day);
  if (cached) return cached;

  const request = fetchJson<CompactMetricSlice>(cityDataUrl(manifest.files.metricsByDay[day])).then(
    (payload) => {
      const records: Record<string, HexDayRecord> = {};
      for (const [h3, [activity, localOrientation, visitorPressure, confidence]] of Object.entries(
        payload.records,
      )) {
        records[h3] = {
          activity,
          localOrientation,
          visitorPressure,
          confidence: {
            activity: confidence[0],
            localOrientation: confidence[1],
            visitorPressure: confidence[2],
          },
        };
      }
      return { ...payload, records };
    },
  );
  dayCache.set(day, request);
  return request;
}

export function loadVenues(manifest: DatasetManifest): Promise<VenueRecord[]> {
  return fetchJson<VenueRecord[]>(cityDataUrl(manifest.files.venues));
}

export function loadCategoryCurves(manifest: DatasetManifest): Promise<CategoryCurves> {
  return fetchJson<CategoryCurves>(cityDataUrl(manifest.files.categoryCurves));
}

/**
 * Load the venue-to-venue retrieval artifact and resolve its integer candidate
 * indices against the loaded venue list, keyed by seed venue id. Scores are
 * rescaled from the on-disk 0-100 ints to 0-1. Returns an empty index when the
 * dataset predates schema v3 (no placeNeighbors file).
 */
export async function loadPlaceNeighbors(
  manifest: DatasetManifest,
  venues: VenueRecord[],
): Promise<PlaceNeighborIndex> {
  const index: PlaceNeighborIndex = new Map();
  if (!manifest.files.placeNeighbors) return index;
  const artifact = await fetchJson<PlaceNeighborsArtifact>(cityDataUrl(manifest.files.placeNeighbors));
  const { similarScoreOrder, complementScoreOrder, roles, similar, complements } = artifact;
  venues.forEach((seed, seedIndex) => {
    const similarNeighbors = (similar[seedIndex] ?? []).flatMap((row) => {
      const venue = venues[row[0]];
      if (!venue) return [];
      const scores = Object.fromEntries(similarScoreOrder.map((key, i) => [key, row[i + 1] / 100]));
      return [{ venue, scores: scores as Record<SimilarChannel, number> }];
    });
    const complementNeighbors = (complements[seedIndex] ?? []).flatMap((row) => {
      const venue = venues[row[0]];
      if (!venue) return [];
      const scores = Object.fromEntries(complementScoreOrder.map((key, i) => [key, row[i + 3] / 100]));
      return [{
        venue,
        distanceMeters: row[1],
        role: roles[row[2]] ?? "alongside",
        scores: scores as Record<ComplementFactor, number>,
      }];
    });
    index.set(seed.id, { similar: similarNeighbors, complements: complementNeighbors });
  });
  return index;
}

/**
 * Load and decode the taste-space artifact (schema v5+). Returns null on older
 * datasets so callers fall back to the legacy 5-dim taste path.
 */
export async function loadTasteSpace(
  manifest: DatasetManifest,
  venues: VenueRecord[],
): Promise<TasteSpace | null> {
  if (!manifest.files.tasteSpace) return null;
  const artifact = await fetchJson<TasteSpaceArtifact>(cityDataUrl(manifest.files.tasteSpace));
  return decodeTasteSpace(artifact, venues.length);
}
