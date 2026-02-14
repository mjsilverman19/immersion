/**
 * Parses Google Takeout "Saved Places.json" (GeoJSON FeatureCollection)
 * into a normalized array of place features for import.
 */

export interface TakeoutFeature {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  googleMapsUrl: string | null;
  countryCode: string | null;
  date: string | null;
}

export interface ParseResult {
  features: TakeoutFeature[];
  skipped: number;
  total: number;
}

const MAX_FEATURES = 500;

/**
 * Parse a Google Takeout Saved Places GeoJSON file.
 * Returns normalized features with [lat, lng] (swapped from GeoJSON [lng, lat]).
 */
export function parseTakeoutJSON(data: unknown): ParseResult {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid file: expected a JSON object");
  }

  const collection = data as Record<string, unknown>;

  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error(
      "Invalid file: expected a GeoJSON FeatureCollection. " +
      "Make sure you uploaded the \"Saved Places.json\" file from Google Takeout."
    );
  }

  const rawFeatures = collection.features as unknown[];
  const total = rawFeatures.length;
  const features: TakeoutFeature[] = [];
  let skipped = 0;

  for (const raw of rawFeatures.slice(0, MAX_FEATURES)) {
    const parsed = parseFeature(raw);
    if (parsed) {
      features.push(parsed);
    } else {
      skipped++;
    }
  }

  // Count any features beyond the cap as skipped
  if (rawFeatures.length > MAX_FEATURES) {
    skipped += rawFeatures.length - MAX_FEATURES;
  }

  return { features, skipped, total };
}

function parseFeature(raw: unknown): TakeoutFeature | null {
  if (!raw || typeof raw !== "object") return null;

  const feature = raw as Record<string, unknown>;
  if (feature.type !== "Feature") return null;

  // Extract coordinates (GeoJSON: [longitude, latitude])
  const geometry = feature.geometry as Record<string, unknown> | undefined;
  let latitude = 0;
  let longitude = 0;

  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates as number[];
    longitude = coords[0] ?? 0;
    latitude = coords[1] ?? 0;
  }

  // Extract properties
  const properties = (feature.properties as Record<string, unknown>) || {};
  const location = (properties.location as Record<string, unknown>) || {};

  const name = (location.name as string) || "";
  const address = (location.address as string) || null;
  const countryCode = (location.country_code as string) || null;
  const googleMapsUrl = (properties.google_maps_url as string) || null;
  const date = (properties.date as string) || null;

  // Skip entries with no name AND invalid coordinates
  if (!name && (latitude === 0 && longitude === 0)) {
    return null;
  }

  // Skip entries with no name at all (can't resolve without a name)
  if (!name) {
    return null;
  }

  return {
    name,
    latitude,
    longitude,
    address,
    googleMapsUrl,
    countryCode,
    date,
  };
}
