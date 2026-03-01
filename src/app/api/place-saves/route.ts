import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { savePlaceSchema, unsavePlaceSchema } from "@/lib/validation/schemas";

export const GET = authenticated(null, async (request, { user, supabase }) => {
  const cityId = request.nextUrl.searchParams.get("city_id");

  let query = supabase
    .from("place_saves")
    .select(
      `
      user_id,
      place_id,
      source_user_id,
      created_at,
      place:places!place_saves_place_id_fkey(id, name, category, photo_urls, latitude, longitude, city_id, city:cities!places_city_id_fkey(name, slug)),
      source_user:profiles!place_saves_source_user_id_fkey(id, username, display_name, avatar_url)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (cityId) {
    query = query.eq("place.city_id", cityId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ place_saves: data });
});

export const POST = authenticated(
  savePlaceSchema,
  async (_request, { user, supabase }, body) => {
    const { error } = await supabase.from("place_saves").upsert(
      {
        user_id: user.id,
        place_id: body.place_id,
        source_user_id: body.source_user_id,
      },
      { onConflict: "user_id,place_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = authenticated(
  unsavePlaceSchema,
  async (_request, { user, supabase }, body) => {
    const { error } = await supabase
      .from("place_saves")
      .delete()
      .eq("user_id", user.id)
      .eq("place_id", body.place_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
);
