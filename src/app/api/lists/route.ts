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
  const { title, description, city_id, is_public, items } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      user_id: user.id,
      title,
      description: description || null,
      city_id: city_id || null,
      is_public: is_public ?? true,
    })
    .select()
    .single();

  if (error || !list) {
    return NextResponse.json(
      { error: error?.message || "Failed to create list" },
      { status: 500 }
    );
  }

  if (items && items.length > 0) {
    const listItems = items.map(
      (item: { place_id: string; note?: string }, idx: number) => ({
        list_id: list.id,
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

  return NextResponse.json({ success: true, list });
}
