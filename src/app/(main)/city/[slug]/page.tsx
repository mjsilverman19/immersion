import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PlaceCard from "@/components/place/PlaceCard";
import ListCard from "@/components/list/ListCard";
import Avatar from "@/components/ui/Avatar";
import CityMap from "@/components/map/CityMap";
import LocalsLikeYou from "@/components/city/LocalsLikeYou";
import Link from "next/link";

interface Props {
  params: { slug: string };
}

export default async function CityPage({ params }: Props) {
  const supabase = createClient();

  const { data: city } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!city) notFound();

  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("city_id", city.id)
    .limit(20);

  const { data: logs } = await supabase
    .from("logs")
    .select("*, profiles!logs_user_id_fkey(username, display_name, avatar_url), places!logs_place_id_fkey(name, category)")
    .eq("places.city_id", city.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: lists } = await supabase
    .from("lists")
    .select("*, profiles!lists_user_id_fkey(username, display_name, avatar_url)")
    .eq("city_id", city.id)
    .eq("is_public", true)
    .order("save_count", { ascending: false })
    .limit(10);

  const { data: locals } = await supabase
    .from("profiles")
    .select("*")
    .eq("home_city_id", city.id)
    .order("contribution_count", { ascending: false })
    .limit(10);

  // Compute place stats
  const placeStats: Record<string, { total: number; sum: number }> = {};
  (logs || []).forEach((log: Record<string, unknown>) => {
    const pid = log.place_id as string;
    if (!placeStats[pid]) placeStats[pid] = { total: 0, sum: 0 };
    placeStats[pid].total++;
    placeStats[pid].sum += log.rating as number;
  });

  return (
    <div className="bg-cream min-h-screen">
      {/* Map + Header */}
      <div className="pb-4">
        <CityMap
          center={[city.latitude, city.longitude]}
          places={places || []}
        />
        <div className="px-4 pt-4">
          <h1 className="font-serif text-2xl text-ink">{city.name}</h1>
          <p className="text-sm text-ink-light">{city.country}</p>
          <div className="mt-2 flex gap-4 text-sm text-ink-light">
            <span>{places?.length || 0} places</span>
            <span>{locals?.length || 0} locals</span>
            <span>{lists?.length || 0} lists</span>
          </div>
        </div>
      </div>

      {/* Locals Like You — taste matching */}
      <LocalsLikeYou cityId={city.id} />

      {/* Top Places */}
      <div className="px-4 pb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
          Top Places
        </h2>
        <div className="space-y-3">
          {(places || []).map((place) => {
            const stats = placeStats[place.id];
            return (
              <PlaceCard
                key={place.id}
                place={place}
                averageRating={stats ? stats.sum / stats.total : undefined}
                logCount={stats?.total}
              />
            );
          })}
          {(!places || places.length === 0) && (
            <p className="text-sm text-ink-light">No places logged in this city yet</p>
          )}
        </div>
      </div>

      {/* Lists */}
      {lists && lists.length > 0 && (
        <div className="px-4 pb-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
            Lists
          </h2>
          <div className="space-y-3">
            {lists.map((list) => {
              const listUser = list.profiles as Record<string, unknown> | null;
              return (
                <ListCard
                  key={list.id}
                  list={{
                    ...list,
                    user: listUser ? {
                      username: listUser.username as string,
                      avatar_url: listUser.avatar_url as string | null,
                      display_name: listUser.display_name as string | null,
                    } : null,
                    city: { name: city.name },
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Locals */}
      {locals && locals.length > 0 && (
        <div className="px-4 pb-24">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
            Locals
          </h2>
          <div className="space-y-2">
            {locals.map((local) => (
              <Link key={local.id} href={`/profile/${local.username}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                <Avatar src={local.avatar_url} alt={local.display_name || local.username} />
                <div>
                  <p className="font-medium text-ink">{local.display_name || local.username}</p>
                  <p className="text-xs text-ink-light">{local.contribution_count} contributions</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
