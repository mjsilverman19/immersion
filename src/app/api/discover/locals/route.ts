import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

interface LogData {
  place_id: string;
  rating: number;
  tags: string[];
  place_category: string;
}

function computeSimilarity(userALogs: LogData[], userBLogs: LogData[]): number {
  // Find shared places
  const bByPlace = new Map<string, LogData>();
  userBLogs.forEach((l) => bByPlace.set(l.place_id, l));

  const sharedPlaces: { a: LogData; b: LogData }[] = [];
  userALogs.forEach((a) => {
    const b = bByPlace.get(a.place_id);
    if (b) sharedPlaces.push({ a, b });
  });

  // Tag overlap (Jaccard)
  const aTags = new Set(userALogs.flatMap((l) => l.tags));
  const bTags = new Set(userBLogs.flatMap((l) => l.tags));
  const tagIntersection = new Set([...aTags].filter((t) => bTags.has(t)));
  const tagUnion = new Set([...aTags, ...bTags]);
  const tagSim = tagUnion.size > 0 ? tagIntersection.size / tagUnion.size : 0;

  // Category similarity (cosine)
  const aCats: Record<string, number> = {};
  const bCats: Record<string, number> = {};
  userALogs.forEach((l) => { aCats[l.place_category] = (aCats[l.place_category] || 0) + 1; });
  userBLogs.forEach((l) => { bCats[l.place_category] = (bCats[l.place_category] || 0) + 1; });

  const allCats = new Set([...Object.keys(aCats), ...Object.keys(bCats)]);
  let dot = 0, magA = 0, magB = 0;
  allCats.forEach((c) => {
    const a = aCats[c] || 0;
    const b = bCats[c] || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  });
  const catSim = magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;

  if (sharedPlaces.length >= 3) {
    // Rating correlation (Pearson)
    const n = sharedPlaces.length;
    const aRatings = sharedPlaces.map((s) => s.a.rating);
    const bRatings = sharedPlaces.map((s) => s.b.rating);
    const meanA = aRatings.reduce((s, v) => s + v, 0) / n;
    const meanB = bRatings.reduce((s, v) => s + v, 0) / n;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
      const da = aRatings[i] - meanA;
      const db = bRatings[i] - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
    const corr = denA > 0 && denB > 0 ? num / (Math.sqrt(denA) * Math.sqrt(denB)) : 0;
    const normCorr = (corr + 1) / 2; // 0 to 1

    return normCorr * 0.5 + tagSim * 0.3 + catSim * 0.2;
  }

  return tagSim * 0.6 + catSim * 0.4;
}

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
    .select("place_id, rating, tags, places!logs_place_id_fkey(category)")
    .eq("user_id", user.id);

  const myLogData: LogData[] = (myLogs || []).map((l: Record<string, unknown>) => ({
    place_id: l.place_id as string,
    rating: l.rating as number,
    tags: l.tags as string[],
    place_category: ((l.places as Record<string, unknown>)?.category as string) || "experience",
  }));

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
        .select("place_id, rating, tags, places!logs_place_id_fkey(category)")
        .eq("user_id", local.id);

      const localLogData: LogData[] = (localLogs || []).map((l: Record<string, unknown>) => ({
        place_id: l.place_id as string,
        rating: l.rating as number,
        tags: l.tags as string[],
        place_category: ((l.places as Record<string, unknown>)?.category as string) || "experience",
      }));

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
