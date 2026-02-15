import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { tastePreferencesSchema } from "@/lib/validation/schemas";

export const POST = authenticated(tastePreferencesSchema, async (_req, { user, supabase }, body) => {
  const updateData: Record<string, string[]> = {
    taste_preferences: body.taste_preferences,
  };
  if (body.category_preferences) {
    updateData.category_preferences = body.category_preferences;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
