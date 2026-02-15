import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listId = params.id;
  const body = await request.json();
  const { title, description, city_id, items } = body;

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
      title,
      description: description || null,
      city_id: city_id || null,
    })
    .eq("id", listId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (items) {
    // Delete old items and insert new ones
    await supabase.from("list_items").delete().eq("list_id", listId);

    if (items.length > 0) {
      const listItems = items.map(
        (item: { place_id: string; note?: string }, idx: number) => ({
          list_id: listId,
          place_id: item.place_id,
          position: idx,
          note: item.note || null,
        })
      );

      const { error: itemsError } = await supabase
        .from("list_items")
        .insert(listItems);

      if (itemsError) {
        return NextResponse.json(
          { error: itemsError.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
