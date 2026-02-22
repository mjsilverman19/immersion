import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import {
  cosineSimilarity,
  computeBehavioralVector,
  blendVectors,
  type LogData,
} from "@/lib/taste-vector";
import type { LogWithPlaceCategory } from "@/lib/types/queries";

function hasVector(v: number[] | null | undefined): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.some((x) => x !== 0);
}

/**
 * GET /api/discover/places?city_id=...&limit=...&category=...
 *
 * Returns places in a city, weighted by ratings from taste-aligned locals
 * rather than raw popularity.
 */
export const GET = authenticated(null, async (request, { user, supabase }) => {
  const cityId = request.nextUrl.searchParams.get("city_id");
  const category = request.nextUrl.searchParams.get("category");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20"), 50);

  if (!cityId) {
    return NextResponse.json({ error: "city_id required" }, { status: 400 });
  }

  // Fetch user profile + logs in parallel
  const [{ data: myProfile }, { data: myLogs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("taste_vector")
      .eq("id", user.id)
      .single(),
    supabase
      .from("logs")
      .select("rating, tags, vibe_tags, places!logs_place_id_fkey(category)")
      .eq("user_id", user.id),
  ]);

  const myLogData: LogData[] = ((myLogs || []) as unknown as LogWithPlaceCategory[]).map(
    (l) => ({
      rating: l.rating,
      tags: l.tags || [],
      vibe_tags: l.vibe_tags || [],
      category: l.places?.category || "experience",
    })
  );

  const myOnboardingVec = myProfile?.taste_vector as number[] | null;
  const myBehavioralVec = computeBehavioralVector(myLogData);
  const myBlendedVec = hasVector(myOnboardingVec)
    ? blendVectors(myOnboardingVec, myBehavioralVec, myLogData.length)
    : null;

  // Fetch places in this city (with optional category filter)
  let placesQuery = supabase.from("places").select("*").eq("city_id", cityId);
  if (category) {
    placesQuery = placesQuery.eq("category", category);
  }
  const { data: places } = await placesQuery;

  if (!places || places.length === 0) {
    return NextResponse.json({ places: [] });
  }

  // Fetch all logs for places in this city
  const placeIds = places.map((p) => p.id);
  const { data: allLogs } = await supabase
    .from("logs")
    .select("place_id, user_id, rating, tags, vibe_tags")
    .in("place_id", placeIds);

  // If we have a taste vector, fetch the profiles of the log authors
  // so we can weight by alignment
  const userVectors = new Map<string, number[]>();

  if (myBlendedVec && allLogs && allLogs.length > 0) {
    const authorIds = [...new Set(allLogs.map((l) => l.user_id))];
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, taste_vector")
      .in("id", authorIds);

    if (authors) {
      for (const author of authors) {
        const vec = author.taste_vector as number[] | null;
        if (hasVector(vec)) {
          userVectors.set(author.id, vec);
        }
      }
    }
  }

  // Group logs by place
  const logsByPlace = new Map<
    string,
    { user_id: string; rating: number; tags: string[]; vibe_tags: string[] }[]
  >();
  for (const log of allLogs || []) {
    if (!logsByPlace.has(log.place_id)) logsByPlace.set(log.place_id, []);
    logsByPlace.get(log.place_id)!.push(log);
  }

  // Score each place
  const scoredPlaces = places.map((place) => {
    const placeLogs = logsByPlace.get(place.id) || [];
    const logCount = placeLogs.length;

    if (logCount === 0) {
      return { ...place, score: 0, log_count: 0, avg_rating: 0 };
    }

    let weightedSum = 0;
    let weightTotal = 0;

    for (const log of placeLogs) {
      let weight = 1;

      // If we can compute alignment, boost ratings from aligned locals
      if (myBlendedVec) {
        const authorVec = userVectors.get(log.user_id);
        if (authorVec) {
          const sim = cosineSimilarity(myBlendedVec, authorVec);
          // Map -1..1 to 0.5..2.0 so aligned locals' ratings count more
          weight = 0.5 + ((sim + 1) / 2) * 1.5;
        }
      }

      weightedSum += log.rating * weight;
      weightTotal += weight;
    }

    const weightedAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;
    // Combine weighted average with log count signal
    const score = weightedAvg * (1 + Math.log2(1 + logCount) * 0.1);

    const avgRating =
      placeLogs.reduce((sum, l) => sum + l.rating, 0) / logCount;

    // Aggregate vibe tags
    const tagCounts = new Map<string, number>();
    placeLogs.forEach((l) => {
      (l.vibe_tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    });
    const topVibeTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return {
      ...place,
      score,
      log_count: logCount,
      avg_rating: Math.round(avgRating * 10) / 10,
      top_vibe_tags: topVibeTags,
    };
  });

  scoredPlaces.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    places: scoredPlaces.slice(0, limit),
  });
});
