import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "@/lib/api/handler";
import { saveSchema } from "@/lib/validation/schemas";

export const POST = authenticated(saveSchema, async (_req, { user, supabase }, body) => {
  const { error } = await supabase
    .from("saves")
    .insert({ user_id: user.id, list_id: body.list_id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});

export const DELETE = authenticated(null, async (request, { user, supabase }) => {
  const listId = request.nextUrl.searchParams.get("list_id");
  const parsed = z.string().uuid().safeParse(listId);

  if (!parsed.success) {
    return NextResponse.json({ error: "Valid list_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saves")
    .delete()
    .eq("user_id", user.id)
    .eq("list_id", parsed.data);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
