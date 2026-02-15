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
  const { taste_preferences, category_preferences } = body;

  if (!Array.isArray(taste_preferences)) {
    return NextResponse.json(
      { error: "taste_preferences must be an array" },
      { status: 400 }
    );
  }

  const updateData: Record<string, string[]> = {
    taste_preferences,
  };
  if (Array.isArray(category_preferences)) {
    updateData.category_preferences = category_preferences;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
