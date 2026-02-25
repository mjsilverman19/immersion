import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CityMapHero from "@/components/city/CityMapHero";
import LocalsLikeYou from "@/components/city/LocalsLikeYou";
import LocalFavoriteCard from "@/components/city/LocalFavoriteCard";
import ActivityRow from "@/components/city/ActivityRow";
import CityListCard from "@/components/city/CityListCard";

interface Props {
  params: { slug: string };
}

export default async function CityPage({ params }: Props) {
  const supabase = createClient();

  // Fetch city
  const { data: city } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!city) notFound();

  // Parallel data fetching
  const [placesResult, localsCountResult, listsResult] = await Promise.all([
    supabase
      .from("places")
      .select("*")
      .eq("city_id", city.id)
      .limit(100),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("home_city_id", city.id),
    supabase
      .from("lists")
      .select("*, profiles!lists_user_id_fkey(username, display_name), list_items(id)")
      .eq("city_id", city.id)
      .eq("is_public", true)
      .order("save_count", { ascending: false })
      .limit(10),
  ]);

  const places = placesResult.data || [];
  const localsCount = localsCountResult.count || 0;
  const lists = listsResult.data || [];

  // Fetch logs for places in this city
  const placeIds = places.map((p) => p.id);
  const { data: logs } = placeIds.length > 0
    ? await supabase
        .from("logs")
        .select("*, profiles!logs_user_id_fkey(username, display_name, avatar_url), places!logs_place_id_fkey(id, name, category)")
        .in("place_id", placeIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] as Record<string, unknown>[] };

  const allLogs = logs || [];
  const totalLogCount = allLogs.length;

  // Compute place stats: log count, avg rating, top vibe tag
  const placeStats: Record<string, { total: number; sum: number; vibeTagCounts: Record<string, number> }> = {};
  allLogs.forEach((log: Record<string, unknown>) => {
    const pid = log.place_id as string;
    if (!placeStats[pid]) placeStats[pid] = { total: 0, sum: 0, vibeTagCounts: {} };
    placeStats[pid].total++;
    placeStats[pid].sum += log.rating as number;
    const vibes = (log.vibe_tags as string[]) || [];
    vibes.forEach((tag) => {
      placeStats[pid].vibeTagCounts[tag] = (placeStats[pid].vibeTagCounts[tag] || 0) + 1;
    });
  });

  // Sort places by popularity for Local Favorites
  const popularPlaces = [...places]
    .filter((p) => placeStats[p.id])
    .sort((a, b) => (placeStats[b.id]?.total || 0) - (placeStats[a.id]?.total || 0))
    .slice(0, 10);

  // Get top vibe tag per place
  function getTopVibeTag(placeId: string): string | null {
    const stats = placeStats[placeId];
    if (!stats) return null;
    const entries = Object.entries(stats.vibeTagCounts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  // Recent activity logs (already sorted by created_at desc)
  const recentLogs = allLogs.slice(0, 10).map((log: Record<string, unknown>) => {
    const profile = log.profiles as Record<string, unknown> | null;
    const place = log.places as Record<string, unknown> | null;
    return {
      id: log.id as string,
      user: {
        username: (profile?.username as string) || "unknown",
        display_name: (profile?.display_name as string | null) || null,
        avatar_url: (profile?.avatar_url as string | null) || null,
      },
      place: {
        id: (place?.id as string) || "",
        name: (place?.name as string) || "Unknown place",
      },
      created_at: log.created_at as string,
    };
  });

  // Format lists for CityListCard
  const formattedLists = lists.map((list) => {
    const profile = list.profiles as Record<string, unknown> | null;
    const items = list.list_items as Record<string, unknown>[] | null;
    return {
      id: list.id,
      title: list.title,
      authorName: (profile?.display_name as string) || (profile?.username as string) || "Unknown",
      itemCount: items?.length || 0,
    };
  });

  return (
    <div className="bg-cream min-h-screen pb-24">
      {/* 1. Map Hero */}
      <CityMapHero
        center={[city.latitude, city.longitude]}
        places={places.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
      />

      {/* 2. City Info */}
      <div className="px-4 pt-5">
        <h1 className="font-serif text-[32px] leading-tight tracking-tight text-ink">
          {city.name}
        </h1>
        <p className="mt-1 text-sm text-ink-light">{city.country}</p>
        <p className="mt-1 text-sm text-ink-light">
          {localsCount} locals · {totalLogCount} logs
        </p>
      </div>

      {/* 3. Your Top Taste Matches */}
      <div className="mt-7">
        <LocalsLikeYou cityId={city.id} />
      </div>

      {/* 4. Local Favorites */}
      {popularPlaces.length > 0 && (
        <div className="mt-7">
          <h2 className="mb-3 px-4 text-xs font-medium uppercase tracking-widest text-ink-light">
            Local Favorites
          </h2>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-2">
            {popularPlaces.map((place) => (
              <LocalFavoriteCard
                key={place.id}
                place={place}
                averageRating={
                  placeStats[place.id]
                    ? placeStats[place.id].sum / placeStats[place.id].total
                    : 0
                }
                topVibeTag={getTopVibeTag(place.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. Recent Activity */}
      {recentLogs.length > 0 && (
        <div className="mt-7 px-4">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-widest text-ink-light">
            Recent Activity
          </h2>
          <div className="divide-y divide-cream-dark">
            {recentLogs.map((log) => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        </div>
      )}

      {/* 6. Lists */}
      {formattedLists.length > 0 && (
        <div className="mt-7 px-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
            Lists
          </h2>
          <div className="space-y-3">
            {formattedLists.map((list) => (
              <CityListCard key={list.id} list={list} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
