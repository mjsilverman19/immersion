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
  const {
    username,
    display_name,
    home_city_id,
    avatar_url,
    taste_preferences,
    category_preferences,
  } = body;

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: username.toLowerCase(),
    display_name: display_name || null,
    home_city_id: home_city_id || null,
    avatar_url: avatar_url || null,
    taste_preferences: taste_preferences || [],
    category_preferences: category_preferences || [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
