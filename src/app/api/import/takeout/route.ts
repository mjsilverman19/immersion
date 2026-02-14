import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { resolvePlace } from "@/lib/import/place-resolver";
import type { TakeoutFeature } from "@/lib/import/takeout-parser";
import type { City, Place } from "@/lib/types/database";

const API_CALL_CAP = 100;
const MAX_FEATURES = 500;

export async function POST(request: NextRequest) {
  const supabase = createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let body: { features: TakeoutFeature[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { features } = body;

  if (!Array.isArray(features) || features.length === 0) {
    return new Response(JSON.stringify({ error: "No places to import" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cappedFeatures = features.slice(0, MAX_FEATURES);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Load all cities for matching
  const { data: cities } = await supabase.from("cities").select("*");
  if (!cities || cities.length === 0) {
    return new Response(JSON.stringify({ error: "No cities in database" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Batch-query existing places by google_maps_url for fast deduplication
  const urlsToCheck = cappedFeatures
    .map((f) => f.googleMapsUrl)
    .filter((url): url is string => !!url);

  const existingUrlMap = new Map<string, Place>();
  if (urlsToCheck.length > 0) {
    // Query in batches of 100 to avoid URL length limits
    for (let i = 0; i < urlsToCheck.length; i += 100) {
      const batch = urlsToCheck.slice(i, i + 100);
      const { data: existingPlaces } = await supabase
        .from("places")
        .select("*")
        .in("google_maps_url", batch);

      if (existingPlaces) {
        for (const place of existingPlaces) {
          if (place.google_maps_url) {
            existingUrlMap.set(place.google_maps_url, place);
          }
        }
      }
    }
  }

  // Create the import list
  const { data: list, error: listError } = await supabase
    .from("lists")
    .insert({
      user_id: user.id,
      title: "Google Maps Import",
      description: `Imported from Google Takeout on ${new Date().toLocaleDateString()}`,
      is_public: false,
    })
    .select()
    .single();

  if (listError || !list) {
    return new Response(
      JSON.stringify({ error: "Failed to create import list" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream progress back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      let processed = 0;
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      let apiCallsUsed = 0;
      let position = 0;
      const importedPlaceIds = new Set<string>();

      for (const feature of cappedFeatures) {
        processed++;

        try {
          const result = await resolvePlace(
            feature,
            cities as City[],
            supabase,
            apiCallsUsed < API_CALL_CAP,
            apiKey,
            existingUrlMap
          );

          apiCallsUsed += result.apiCallsMade;

          if (!result.place) {
            skipped++;
            emit({
              type: "progress",
              processed,
              total: cappedFeatures.length,
              current: feature.name,
              status: "skipped",
            });
            continue;
          }

          // Skip duplicate place in this import
          if (importedPlaceIds.has(result.place.id)) {
            skipped++;
            emit({
              type: "progress",
              processed,
              total: cappedFeatures.length,
              current: feature.name,
              status: "duplicate",
            });
            continue;
          }

          // Add to list
          position++;
          const { error: itemError } = await supabase
            .from("list_items")
            .insert({
              list_id: list.id,
              place_id: result.place.id,
              position,
            });

          if (itemError) {
            // Likely duplicate list_item — count as already imported
            if (itemError.code === "23505") {
              skipped++;
            } else {
              errors++;
            }
          } else {
            imported++;
            importedPlaceIds.add(result.place.id);
          }

          emit({
            type: "progress",
            processed,
            total: cappedFeatures.length,
            current: feature.name,
            status: itemError ? "skipped" : "imported",
            method: result.method,
          });
        } catch (err) {
          errors++;
          emit({
            type: "error",
            processed,
            total: cappedFeatures.length,
            current: feature.name,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      emit({
        type: "complete",
        list_id: list.id,
        imported,
        skipped,
        errors,
        api_calls_used: apiCallsUsed,
        total: cappedFeatures.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
