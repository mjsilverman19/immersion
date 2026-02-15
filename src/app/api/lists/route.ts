import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { createListSchema } from "@/lib/validation/schemas";

export const POST = authenticated(createListSchema, async (_req, { user, supabase }, body) => {
  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      user_id: user.id,
      title: body.title,
      description: body.description,
      city_id: body.city_id,
      is_public: body.is_public,
    })
    .select()
    .single();

  if (error || !list) {
    return NextResponse.json(
      { error: error?.message || "Failed to create list" },
      { status: 500 }
    );
  }

  if (body.items.length > 0) {
    const listItems = body.items.map((item, idx) => ({
      list_id: list.id,
      place_id: item.place_id,
      position: idx,
      note: item.note,
    }));

    const { error: itemsError } = await supabase
      .from("list_items")
      .insert(listItems);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, list });
});
