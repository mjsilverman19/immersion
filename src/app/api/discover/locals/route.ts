import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "@/lib/api/handler";
import { computeSimilarity, mapLogRow } from "@/lib/discover/similarity";
import {
  cosineSimilarity,
  computeBehavioralVector,
  blendVectors,
  type LogData,
} from "@/lib/taste-vector";
import type { LogWithPlaceCategory } from "@/lib/types/queries";

// ── Helpers ────────────────────────────────────────────────────────

function getConfidence(logCount: number): "high" | "medium" | "low" | "new" {
  if (logCount >= 20) return "high";
  if (logCount >= 5) return "medium";
  if (logCount >= 3) return "low";
  return "new";
}

function getTopVibeTags(
  logs: { vibe_tags: string[] }[],
  limit = 5
): string[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const tag of log.vibe_tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function hasVector(v: number[] | null | undefined): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.some((x) => x !== 0);
}

// ── Main handler ──────────────────────────────────────────────────

export const GET = authenticated(null, async (request, { user, supabase }) => {
  const cityId = request.nextUrl.searchParams.get("city_id");
  const parsed = z.string().uuid().safeParse(cityId);

  if (!parsed.success) {
    return NextResponse.json({ error: "city_id required" }, { status: 400 });
  }

  // Fetch current user's profile + logs in parallel
  const [{ data: myProfile }, { data: myLogs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("taste_vector, taste_vector_version")
      .eq("id", user.id)
      .single(),
    supabase
      .from("logs")
      .select(
        "place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)"
      )
      .eq("user_id", user.id),
  ]);

  // Build typed log data for both vector and legacy paths
  const typedMyLogs = (myLogs || []) as unknown as LogWithPlaceCategory[];

  const myLogData: LogData[] = typedMyLogs.map((l) => ({
    rating: l.rating,
    tags: l.tags || [],
    vibe_tags: l.vibe_tags || [],
    category: l.places?.category || "experience",
  }));

  const myLegacyLogData = typedMyLogs.map((l) => mapLogRow(l));

  // Compute requesting user's blended vector
  const myOnboardingVec = myProfile?.taste_vector as number[] | null;
  const myBehavioralVec = computeBehavioralVector(myLogData);
  const myBlendedVec = hasVector(myOnboardingVec)
    ? blendVectors(myOnboardingVec, myBehavioralVec, myLogData.length)
    : null;

  // Single query: fetch all locals in the city
  const { data: locals } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, contribution_count, taste_vector, taste_vector_version"
    )
    .eq("home_city_id", parsed.data)
    .neq("id", user.id)
    .order("contribution_count", { ascending: false })
    .limit(50);

  if (!locals || locals.length === 0) {
    return NextResponse.json({ locals: [] });
  }

  // Fetch all logs for these locals in a single query (eliminates N+1)
  const localIds = locals.map((l) => l.id);
  const { data: allLocalLogs } = await supabase
    .from("logs")
    .select(
      "user_id, place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)"
    )
    .in("user_id", localIds);

  // Group logs by user_id
  const logsByUser = new Map<string, LogWithPlaceCategory[]>();
  for (const log of (allLocalLogs || []) as unknown as (LogWithPlaceCategory & { user_id: string })[]) {
    const userId = log.user_id;
    if (!logsByUser.has(userId)) logsByUser.set(userId, []);
    logsByUser.get(userId)!.push(log);
  }

  // Score each local
  const results = locals.map((local) => {
    const localRawLogs = logsByUser.get(local.id) || [];
    const localLogCount = localRawLogs.length;
    const confidence = getConfidence(localLogCount);

    const topVibeTags = getTopVibeTags(
      localRawLogs.map((l) => ({
        vibe_tags: l.vibe_tags || [],
      }))
    );

    let tasteMatch = 0;
    const localVec = local.taste_vector as number[] | null;

    if (myBlendedVec && hasVector(localVec)) {
      // Vector-based matching
      const localLogData: LogData[] = localRawLogs.map((l) => ({
        rating: l.rating,
        tags: l.tags || [],
        vibe_tags: l.vibe_tags || [],
        category: l.places?.category || "experience",
      }));

      const localBehavioral = computeBehavioralVector(localLogData);
      const localBlended = blendVectors(
        localVec,
        localBehavioral,
        localLogCount
      );

      // cosine similarity returns -1 to 1, map to 0-100
      const raw = cosineSimilarity(myBlendedVec, localBlended);
      tasteMatch = Math.round(((raw + 1) / 2) * 100);
    } else if (myLegacyLogData.length > 0 && localRawLogs.length > 0) {
      // Legacy fallback
      const localLegacyData = localRawLogs.map((l) => mapLogRow(l));
      tasteMatch = Math.round(
        computeSimilarity(myLegacyLogData, localLegacyData) * 100
      );
    }

    return {
      id: local.id,
      username: local.username,
      display_name: local.display_name,
      avatar_url: local.avatar_url,
      contribution_count: local.contribution_count,
      taste_match: confidence === "new" ? 0 : tasteMatch,
      confidence,
      top_vibe_tags: topVibeTags,
      is_new: confidence === "new",
    };
  });

  results.sort((a, b) => b.taste_match - a.taste_match);

  return NextResponse.json({ locals: results });
});
