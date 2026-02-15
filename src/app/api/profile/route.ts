import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { updateProfileSchema } from "@/lib/validation/schemas";

export const PUT = authenticated(updateProfileSchema, async (_req, { user, supabase }, body) => {
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: body.display_name,
      bio: body.bio,
      home_city_id: body.home_city_id,
      avatar_url: body.avatar_url,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
