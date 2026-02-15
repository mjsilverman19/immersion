import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MapClient from "./map-client";
import type { Place } from "@/lib/types/database";
import type { LogWithPlaceFull, ListItemWithPlaces, ProfileWithCityCoords } from "@/lib/types/queries";

export default async function GlobalMapPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Parallelize independent queries
  const [
    { data: logs },
    { data: lists },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("logs")
      .select("*, places(*)")
      .eq("user_id", user.id),
    supabase
      .from("lists")
      .select("id")
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("*, city:cities!profiles_home_city_id_fkey(latitude, longitude)")
      .eq("id", user.id)
      .single(),
  ]);

  const placeMap = new Map<string, Place>();

  if (logs) {
    for (const log of logs as unknown as LogWithPlaceFull[]) {
      if (log.places?.id) placeMap.set(log.places.id, log.places);
    }
  }

  if (lists && lists.length > 0) {
    const listIds = lists.map((l) => l.id);
    const { data: listItems } = await supabase
      .from("list_items")
      .select("*, places(*)")
      .in("list_id", listIds);

    if (listItems) {
      for (const item of listItems as unknown as ListItemWithPlaces[]) {
        if (item.places?.id) placeMap.set(item.places.id, item.places);
      }
    }
  }

  const places = Array.from(placeMap.values());

  const typedProfile = profile as unknown as ProfileWithCityCoords | null;
  let center: [number, number] | null = null;
  if (typedProfile?.city) {
    center = [typedProfile.city.latitude, typedProfile.city.longitude];
  } else if (places.length > 0) {
    center = [places[0].latitude, places[0].longitude];
  }

  return <MapClient places={places} center={center} />;
}
