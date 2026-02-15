import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function PUT(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { display_name, bio, home_city_id, avatar_url } = body;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: display_name || null,
      bio: bio || null,
      home_city_id: home_city_id || null,
      avatar_url: avatar_url || null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
