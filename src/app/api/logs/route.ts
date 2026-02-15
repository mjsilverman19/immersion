import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { createLogSchema } from "@/lib/validation/schemas";

export const POST = authenticated(createLogSchema, async (_req, { user, supabase }, body) => {
  const { error } = await supabase
    .from("logs")
    .upsert(
      {
        user_id: user.id,
        place_id: body.place_id,
        rating: body.rating,
        tags: body.tags,
        vibe_tags: body.vibe_tags,
        review: body.review,
        is_local_log: body.is_local_log,
      },
      { onConflict: "user_id,place_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
