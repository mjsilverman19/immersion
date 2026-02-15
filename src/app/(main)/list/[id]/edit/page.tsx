import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EditListClient from "./edit-client";
import type { Place } from "@/lib/types/database";

interface Props {
  params: { id: string };
}

export default async function EditListPage({ params }: Props) {
  const supabase = createClient();

  const { data: list } = await supabase
    .from("lists")
    .select("id, title, description, city_id")
    .eq("id", params.id)
    .single();

  if (!list) notFound();

  const { data: listItems } = await supabase
    .from("list_items")
    .select("note, place:places!list_items_place_id_fkey(*)")
    .eq("list_id", params.id)
    .order("position");

  const items = (listItems || []).map((item) => ({
    place: item.place as unknown as Place,
    note: item.note || "",
  }));

  return <EditListClient list={list} items={items} />;
}
