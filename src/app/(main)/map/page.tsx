import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MapClient from "./map-client";
import type { Place } from "@/lib/types/database";

export default async function GlobalMapPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const placeMap = new Map<string, Place>();

  // Fetch places the user has logged
  const { data: logs } = await supabase
    .from("logs")
    .select("*, places(*)")
    .eq("user_id", user.id);

  if (logs) {
    for (const log of logs) {
      const place = (log as Record<string, unknown>).places as Place | null;
      if (place?.id) placeMap.set(place.id, place);
    }
  }

  // Fetch places from the user's lists
  const { data: lists } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id);

  if (lists && lists.length > 0) {
    const listIds = lists.map((l) => l.id);
    const { data: listItems } = await supabase
      .from("list_items")
      .select("*, places(*)")
      .in("list_id", listIds);

    if (listItems) {
      for (const item of listItems) {
        const place = (item as Record<string, unknown>).places as Place | null;
        if (place?.id) placeMap.set(place.id, place);
      }
    }
  }

  // Get user's home city for map center
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, city:cities!profiles_home_city_id_fkey(latitude, longitude)")
    .eq("id", user.id)
    .single();

  const places = Array.from(placeMap.values());

  let center: [number, number] | null = null;
  if (profile?.city) {
    const city = profile.city as { latitude: number; longitude: number };
    center = [city.latitude, city.longitude];
  } else if (places.length > 0) {
    center = [places[0].latitude, places[0].longitude];
  }

  return <MapClient places={places} center={center} />;
}
