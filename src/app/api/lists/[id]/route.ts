import { NextResponse, type NextRequest } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { updateListSchema } from "@/lib/validation/schemas";

export const PUT = authenticated(updateListSchema, async (request: NextRequest, { user, supabase }, body) => {
  const listId = request.nextUrl.pathname.split("/").pop()!;

  // Verify ownership
  const { data: list } = await supabase
    .from("lists")
    .select("user_id")
    .eq("id", listId)
    .single();

  if (!list || list.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("lists")
    .update({
      title: body.title,
      description: body.description,
      city_id: body.city_id,
    })
    .eq("id", listId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (body.items) {
    // Delete old items and insert new ones
    await supabase.from("list_items").delete().eq("list_id", listId);

    if (body.items.length > 0) {
      const listItems = body.items.map((item, idx) => ({
        list_id: listId,
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
  }

  return NextResponse.json({ success: true });
});
