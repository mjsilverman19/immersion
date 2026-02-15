import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import LogFormWrapper from "./LogFormWrapper";

interface Props {
  params: { id: string };
}

export default async function LogPlacePage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!place) notFound();

  // Fetch existing log + profile server-side
  const [{ data: existingLog }, { data: profile }] = await Promise.all([
    supabase
      .from("logs")
      .select("id, rating, tags, vibe_tags, review")
      .eq("user_id", user.id)
      .eq("place_id", place.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("home_city_id")
      .eq("id", user.id)
      .single(),
  ]);

  return (
    <div className="bg-cream min-h-screen p-4 pb-24">
      <LogFormWrapper
        place={place}
        userId={user.id}
        existingLog={existingLog}
        homeCityId={profile?.home_city_id ?? null}
      />
    </div>
  );
}
