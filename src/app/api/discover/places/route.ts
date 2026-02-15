import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  computeSimilarity,
  type LogData,
} from "@/lib/discover/similarity";
import { CATEGORY_TO_PREFERENCE } from "@/lib/discover/categories";
import type { PlaceCategory } from "@/lib/types/database";

interface PlaceResult {
  id: string;
  name: string;
  address: string | null;
  category: string;
  latitude: number;
  longitude: number;
  photo_urls: string[] | null;
  google_maps_url: string | null;
  score: number;
  match_level: "strong" | "good" | "moderate" | null;
  top_vibe_tags: string[];
  attribution: string | null;
  mode: "collaborative" | "preference" | "quality";
  log_count: number;
  avg_rating: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("city_id");
  const category = searchParams.get("category") as PlaceCategory | null;

  if (!cityId) {
    return NextResponse.json({ error: "city_id required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user profile for taste/category preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("taste_preferences, category_preferences")
    .eq("id", user.id)
    .single();

  const tastePrefs = profile?.taste_preferences || [];
  const categoryPrefs = profile?.category_preferences || [];

  // Query 1: Fetch all places in the city (with optional category filter)
  let placesQuery = supabase.from("places").select("*").eq("city_id", cityId);
  if (category) {
    placesQuery = placesQuery.eq("category", category);
  }
  const { data: places } = await placesQuery;

  if (!places || places.length === 0) {
    return NextResponse.json({ places: [], mode: "quality" });
  }

  const placeIds = places.map((p) => p.id);

  // Query 2: Fetch ALL logs for these places in a single query
  // Join profiles for home_city_id (local detection)
  const { data: allCityLogs } = await supabase
    .from("logs")
    .select(
      "id, user_id, place_id, rating, tags, vibe_tags, is_local_log, profiles!logs_user_id_fkey(home_city_id), places!logs_place_id_fkey(category, city_id)"
    )
    .in("place_id", placeIds);

  // Query 3: Fetch the requesting user's own logs (all cities) for similarity
  const { data: myLogsRaw } = await supabase
    .from("logs")
    .select(
      "place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)"
    )
    .eq("user_id", user.id);

  const myLogs: LogData[] = (myLogsRaw || []).map(
    (l: Record<string, unknown>) => ({
      place_id: l.place_id as string,
      rating: l.rating as number,
      tags: (l.tags as string[]) || [],
      vibe_tags: (l.vibe_tags as string[]) || [],
      place_category:
        ((l.places as Record<string, unknown>)?.category as string) ||
        "experience",
    })
  );

  // Group city logs by place_id and by user_id
  const logsByPlace = new Map<string, Record<string, unknown>[]>();
  const logsByUser = new Map<string, LogData[]>();

  (allCityLogs || []).forEach((log: Record<string, unknown>) => {
    const pid = log.place_id as string;
    const uid = log.user_id as string;

    if (!logsByPlace.has(pid)) logsByPlace.set(pid, []);
    logsByPlace.get(pid)!.push(log);

    if (uid !== user.id) {
      if (!logsByUser.has(uid)) logsByUser.set(uid, []);
      logsByUser.get(uid)!.push({
        place_id: pid,
        rating: log.rating as number,
        tags: (log.tags as string[]) || [],
        vibe_tags: (log.vibe_tags as string[]) || [],
        place_category:
          ((log.places as Record<string, unknown>)?.category as string) ||
          "experience",
      });
    }
  });

  // Determine scoring mode
  const mode: "collaborative" | "preference" | "quality" =
    myLogs.length >= 5
      ? "collaborative"
      : tastePrefs.length > 0
        ? "preference"
        : "quality";

  // Pre-compute similarities for collaborative mode
  const userSimilarities = new Map<string, number>();
  if (mode === "collaborative") {
    for (const [uid, uLogs] of logsByUser) {
      userSimilarities.set(uid, computeSimilarity(myLogs, uLogs));
    }
  }

  // Score each place
  const results: PlaceResult[] = places.map((place) => {
    const placeLogs = logsByPlace.get(place.id) || [];
    const logCount = placeLogs.length;
    const totalRating = placeLogs.reduce(
      (sum, l) => sum + (l.rating as number),
      0
    );
    const avgRating = logCount > 0 ? totalRating / logCount : 0;

    // Aggregate vibe tags across all logs for this place
    const tagCounts = new Map<string, number>();
    placeLogs.forEach((l) => {
      const vibeTags = (l.vibe_tags as string[]) || [];
      vibeTags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    });
    const topVibeTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // Local log percentage
    const localLogs = placeLogs.filter((l) => {
      const logProfile = l.profiles as Record<string, unknown> | null;
      return logProfile?.home_city_id === cityId;
    });
    const localPct = logCount > 0 ? localLogs.length / logCount : 0;

    let score = 0;
    let attribution: string | null = null;

    if (mode === "collaborative") {
      // Weighted average: similarity × rating for each user who logged this place
      let weightedSum = 0;
      let weightTotal = 0;
      placeLogs.forEach((l) => {
        const uid = l.user_id as string;
        if (uid === user.id) return;
        const sim = userSimilarities.get(uid) || 0;
        if (sim > 0) {
          weightedSum += sim * (l.rating as number);
          weightTotal += sim;
        }
      });

      if (weightTotal > 0) {
        // Normalize to 0-1 (ratings are 1-5, so divide by 5)
        score = (weightedSum / weightTotal) / 5;
        // Boost by volume — more similar users = more confidence
        const uniqueContributors = new Set(
          placeLogs
            .filter((l) => {
              const uid = l.user_id as string;
              return uid !== user.id && (userSimilarities.get(uid) || 0) > 0;
            })
            .map((l) => l.user_id as string)
        ).size;
        score = score * (1 + Math.log2(Math.max(1, uniqueContributors)) * 0.1);
        score = Math.min(1, score);

        // Attribution: find the most similar user who logged this
        let bestSim = 0;
        let bestUser: string | null = null;
        placeLogs.forEach((l) => {
          const uid = l.user_id as string;
          if (uid === user.id) return;
          const sim = userSimilarities.get(uid) || 0;
          if (sim > bestSim) {
            bestSim = sim;
            bestUser = uid;
          }
        });
        if (bestUser && bestSim > 0.3) {
          attribution = `Loved by someone with ${Math.round(bestSim * 100)}% similar taste`;
        }
      } else {
        // Fallback to quality for places with no similar-user logs
        score = qualityScore(logCount, avgRating, localPct);
      }
    } else if (mode === "preference") {
      // Jaccard overlap between place's aggregate vibe_tags and user's taste_preferences
      const placeTags = new Set(topVibeTags);
      // Also include all vibe tags from logs, not just top 3
      placeLogs.forEach((l) => {
        ((l.vibe_tags as string[]) || []).forEach((t) => placeTags.add(t));
      });

      const userTags = new Set(tastePrefs);
      const intersection = new Set(
        [...placeTags].filter((t) => userTags.has(t))
      );
      const union = new Set([...placeTags, ...userTags]);
      const tagScore = union.size > 0 ? intersection.size / union.size : 0;

      // Category preference boost
      const placePreference =
        CATEGORY_TO_PREFERENCE[place.category as PlaceCategory];
      const catBoost =
        placePreference && categoryPrefs.includes(placePreference) ? 0.15 : 0;

      score = Math.min(1, tagScore * 0.7 + catBoost + qualityScore(logCount, avgRating, localPct) * 0.15);
    } else {
      // Quality heuristic
      score = qualityScore(logCount, avgRating, localPct);
    }

    const matchLevel =
      score >= 0.7
        ? ("strong" as const)
        : score >= 0.4
          ? ("good" as const)
          : score >= 0.2
            ? ("moderate" as const)
            : null;

    return {
      id: place.id,
      name: place.name,
      address: place.address,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      photo_urls: place.photo_urls,
      google_maps_url: place.google_maps_url,
      score,
      match_level: matchLevel,
      top_vibe_tags: topVibeTags,
      attribution,
      mode,
      log_count: logCount,
      avg_rating: Math.round(avgRating * 10) / 10,
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({ places: results, mode });
}

/** Quality heuristic: combines log count, average rating, and local percentage */
function qualityScore(
  logCount: number,
  avgRating: number,
  localPct: number
): number {
  if (logCount === 0) return 0;
  const ratingNorm = avgRating / 5;
  const countSignal = Math.min(1, Math.log2(logCount + 1) / 4);
  const localBoost = 1 + localPct * 0.3;
  return Math.min(1, ratingNorm * 0.5 * localBoost + countSignal * 0.5);
}
