import type {
  CompactMetricSlice,
  CategoryCurves,
  DatasetManifest,
  HexDayRecord,
  HexGeometryCollection,
  MetricSlice,
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
  if (manifest.schemaVersion !== 2 || manifest.city !== "nyc") {
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
