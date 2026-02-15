import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "@/lib/api/handler";
import { computeSimilarity, mapLogRow } from "@/lib/discover/similarity";
import type { LogWithPlaceCategory } from "@/lib/types/queries";

export const GET = authenticated(null, async (request, { user, supabase }) => {
  const cityId = request.nextUrl.searchParams.get("city_id");
  const parsed = z.string().uuid().safeParse(cityId);

  if (!parsed.success) {
    return NextResponse.json({ error: "city_id required" }, { status: 400 });
  }

  // Get current user's logs
  const { data: myLogs } = await supabase
    .from("logs")
    .select("place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)")
    .eq("user_id", user.id);

  const myLogData = ((myLogs || []) as unknown as LogWithPlaceCategory[]).map((l) => mapLogRow(l));

  // Get locals in the city
  const { data: locals } = await supabase
    .from("profiles")
    .select("*")
    .eq("home_city_id", parsed.data)
    .neq("id", user.id)
    .order("contribution_count", { ascending: false })
    .limit(50);

  if (!locals || locals.length === 0) {
    return NextResponse.json({ locals: [] });
  }

  // Compute similarity for each local
  const results = await Promise.all(
    locals.map(async (local) => {
      const { data: localLogs } = await supabase
        .from("logs")
        .select("place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)")
        .eq("user_id", local.id);

      const localLogData = ((localLogs || []) as unknown as LogWithPlaceCategory[]).map((l) => mapLogRow(l));

      const similarity = myLogData.length > 0 && localLogData.length > 0
        ? computeSimilarity(myLogData, localLogData)
        : 0;

      return {
        ...local,
        taste_match: Math.round(similarity * 100),
      };
    })
  );

  results.sort((a, b) => b.taste_match - a.taste_match);

  return NextResponse.json({ locals: results });
});
