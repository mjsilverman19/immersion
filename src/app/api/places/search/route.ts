import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const cityId = searchParams.get("city_id");

  if (!query || query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  const supabase = createClient();

  let dbQuery = supabase
    .from("places")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(10);

  if (cityId) {
    dbQuery = dbQuery.eq("city_id", cityId);
  }

  const { data: localPlaces } = await dbQuery;
  const places = localPlaces || [];

  if (places.length >= 3) {
    return NextResponse.json({ places });
  }

  // If insufficient local results, try Google Places API
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places });
  }

  try {
    const googleRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const googleData = await googleRes.json();

    const googlePlaces = (googleData.results || []).slice(0, 5).map((r: Record<string, unknown>) => ({
      id: `google_${r.place_id}`,
      google_place_id: r.place_id,
      name: r.name,
      address: r.formatted_address,
      latitude: (r.geometry as Record<string, Record<string, number>>)?.location?.lat || 0,
      longitude: (r.geometry as Record<string, Record<string, number>>)?.location?.lng || 0,
      category: "experience",
      _isGoogle: true,
    }));

    // Deduplicate by google_place_id
    const existingGoogleIds = new Set(places.filter(p => p.google_place_id).map(p => p.google_place_id));
    const newGooglePlaces = googlePlaces.filter((g: Record<string, unknown>) => !existingGoogleIds.has(g.google_place_id as string));

    return NextResponse.json({ places: [...places, ...newGooglePlaces] });
  } catch {
    return NextResponse.json({ places });
  }
}
