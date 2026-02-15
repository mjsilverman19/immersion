import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { onboardingSchema } from "@/lib/validation/schemas";

export const POST = authenticated(onboardingSchema, async (_req, { user, supabase }, body) => {
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: body.username,
    display_name: body.display_name,
    home_city_id: body.home_city_id,
    avatar_url: body.avatar_url,
    taste_preferences: body.taste_preferences,
    category_preferences: body.category_preferences,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
