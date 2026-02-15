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
  const { list_id } = body;

  if (!list_id) {
    return NextResponse.json(
      { error: "list_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("saves")
    .insert({ user_id: user.id, list_id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("list_id");

  if (!listId) {
    return NextResponse.json(
      { error: "list_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("saves")
    .delete()
    .eq("user_id", user.id)
    .eq("list_id", listId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
