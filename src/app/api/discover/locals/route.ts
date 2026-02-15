import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { computeSimilarity, mapLogRow } from "@/lib/discover/similarity";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("city_id");

  if (!cityId) {
    return NextResponse.json({ error: "city_id required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get current user's logs
  const { data: myLogs } = await supabase
    .from("logs")
    .select("place_id, rating, tags, vibe_tags, places!logs_place_id_fkey(category)")
    .eq("user_id", user.id);

  const myLogData = (myLogs || []).map((l: Record<string, unknown>) => mapLogRow(l));

  // Get locals in the city
  const { data: locals } = await supabase
    .from("profiles")
    .select("*")
    .eq("home_city_id", cityId)
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

      const localLogData = (localLogs || []).map((l: Record<string, unknown>) => mapLogRow(l));

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
}
