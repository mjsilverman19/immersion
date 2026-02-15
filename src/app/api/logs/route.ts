import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { place_id, rating, tags, vibe_tags, review, is_local_log } = body;

  if (!place_id || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check for existing log (upsert behavior)
  const { data: existing } = await supabase
    .from("logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("place_id", place_id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("logs")
      .update({
        rating,
        tags: tags || [],
        vibe_tags: vibe_tags || [],
        review: review || null,
        is_local_log: is_local_log || false,
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: true });
  }

  const { error } = await supabase.from("logs").insert({
    user_id: user.id,
    place_id,
    rating,
    tags: tags || [],
    vibe_tags: vibe_tags || [],
    review: review || null,
    is_local_log: is_local_log || false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: false });
}
