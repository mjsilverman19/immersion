/**
 * Resolves a parsed Takeout feature to a place in the database.
 * Uses a multi-step pipeline: DB match → Google API → fallback creation.
 */

import { CATEGORY_MAP } from "@/constants/tags";
import type { TakeoutFeature } from "./takeout-parser";
import type { City, Place, PlaceCategory } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolveResult {
  place: Place | null;
  apiCallsMade: number;
  method: "existing_url" | "existing_name" | "google_api" | "fallback" | "skipped";
}

/**
 * Find the closest city to the given coordinates using Euclidean distance.
 * Mirrors the logic in /api/places/create-from-google/route.ts
 */
export function findClosestCity(lat: number, lng: number, cities: City[]): City | null {
  let closest: City | null = null;
  let minDist = Infinity;

  for (const city of cities) {
    const dist = Math.sqrt(
      Math.pow(city.latitude - lat, 2) + Math.pow(city.longitude - lng, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = city;
    }
  }

  return closest;
}

/**
 * Map Google Places types to app category.
 * Mirrors the logic in /api/places/create-from-google/route.ts
 */
function mapCategory(types: string[]): PlaceCategory {
  for (const type of types) {
    const mapped = CATEGORY_MAP[type];
    if (mapped) return mapped;
  }
  return "experience";
}

/**
 * Resolve a single Takeout feature to a database place.
 * Pipeline (cheapest first):
 *   1. Match by google_maps_url in existing places
 *   2. Match by name + geographic proximity
 *   3. Look up via Google Find Place API
 *   4. Create a minimal fallback place
 */
export async function resolvePlace(
  feature: TakeoutFeature,
  cities: City[],
  supabase: SupabaseClient,
  allowApiCalls: boolean,
  apiKey: string | undefined,
  existingUrlMap: Map<string, Place>
): Promise<ResolveResult> {
  // Step 1: Check existing places by google_maps_url (using pre-fetched map)
  if (feature.googleMapsUrl && existingUrlMap.has(feature.googleMapsUrl)) {
    return {
      place: existingUrlMap.get(feature.googleMapsUrl)!,
      apiCallsMade: 0,
      method: "existing_url",
    };
  }

  // Step 2: Check by name + proximity
  const hasValidCoords = feature.latitude !== 0 || feature.longitude !== 0;
  if (feature.name && hasValidCoords) {
    const { data: candidates } = await supabase
      .from("places")
      .select("*")
      .ilike("name", feature.name);

    if (candidates && candidates.length > 0) {
      const match = candidates.find(
        (c: Place) =>
          Math.abs(c.latitude - feature.latitude) < 0.01 &&
          Math.abs(c.longitude - feature.longitude) < 0.01
      );
      if (match) {
        return { place: match, apiCallsMade: 0, method: "existing_name" };
      }
    }
  }

  // Step 3: Google Find Place API lookup
  if (allowApiCalls && apiKey && feature.name) {
    try {
      const locationBias = hasValidCoords
        ? `&locationbias=point:${feature.latitude},${feature.longitude}`
        : "";

      const findRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
          `input=${encodeURIComponent(feature.name)}` +
          `&inputtype=textquery${locationBias}` +
          `&fields=place_id,name,formatted_address,geometry,types` +
          `&key=${apiKey}`
      );
      const findData = await findRes.json();
      const candidate = findData.candidates?.[0];

      if (candidate?.place_id) {
        // Check if this google_place_id already exists in DB
        const { data: existingByPlaceId } = await supabase
          .from("places")
          .select("*")
          .eq("google_place_id", candidate.place_id)
          .maybeSingle();

        if (existingByPlaceId) {
          return { place: existingByPlaceId, apiCallsMade: 1, method: "google_api" };
        }

        // Create new place from Google data
        const lat = candidate.geometry?.location?.lat || feature.latitude;
        const lng = candidate.geometry?.location?.lng || feature.longitude;
        const closestCity = findClosestCity(lat, lng, cities);

        if (!closestCity) {
          return { place: null, apiCallsMade: 1, method: "skipped" };
        }

        const category = mapCategory(candidate.types || []);

        const { data: newPlace, error } = await supabase
          .from("places")
          .insert({
            google_place_id: candidate.place_id,
            name: candidate.name || feature.name,
            city_id: closestCity.id,
            address: candidate.formatted_address || feature.address || null,
            latitude: lat,
            longitude: lng,
            category,
            google_maps_url: feature.googleMapsUrl || null,
          })
          .select()
          .single();

        if (error) {
          // Likely a unique constraint violation — try to fetch existing
          if (error.code === "23505") {
            const { data: existing } = await supabase
              .from("places")
              .select("*")
              .eq("google_place_id", candidate.place_id)
              .maybeSingle();
            if (existing) {
              return { place: existing, apiCallsMade: 1, method: "google_api" };
            }
          }
          // Other error — fall through to fallback
        } else {
          return { place: newPlace, apiCallsMade: 1, method: "google_api" };
        }
      }
    } catch {
      // Google API error — fall through to fallback
    }

    // Even if API failed, we used a call
    return createFallbackPlace(feature, cities, supabase, 1);
  }

  // Step 4: Fallback — create without Google enrichment
  return createFallbackPlace(feature, cities, supabase, 0);
}

async function createFallbackPlace(
  feature: TakeoutFeature,
  cities: City[],
  supabase: SupabaseClient,
  apiCallsMade: number
): Promise<ResolveResult> {
  const hasValidCoords = feature.latitude !== 0 || feature.longitude !== 0;

  if (!hasValidCoords || !feature.name) {
    return { place: null, apiCallsMade, method: "skipped" };
  }

  const closestCity = findClosestCity(feature.latitude, feature.longitude, cities);
  if (!closestCity) {
    return { place: null, apiCallsMade, method: "skipped" };
  }

  const { data: newPlace, error } = await supabase
    .from("places")
    .insert({
      name: feature.name,
      city_id: closestCity.id,
      address: feature.address || null,
      latitude: feature.latitude,
      longitude: feature.longitude,
      category: "experience",
      google_maps_url: feature.googleMapsUrl || null,
    })
    .select()
    .single();

  if (error) {
    return { place: null, apiCallsMade, method: "skipped" };
  }

  return { place: newPlace, apiCallsMade, method: "fallback" };
}
