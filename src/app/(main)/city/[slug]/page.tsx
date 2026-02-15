import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PlaceCard from "@/components/place/PlaceCard";
import ListCard from "@/components/list/ListCard";
import Avatar from "@/components/ui/Avatar";
import CityMap from "@/components/map/CityMap";
import UnlockProgress from "@/components/city/UnlockProgress";
import LocalsLikeYou from "@/components/city/LocalsLikeYou";
import Link from "next/link";
import { getUnlockProgress } from "@/lib/utils/unlock";

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

  // Get current user + profile for unlock check
  const { data: { user } } = await supabase.auth.getUser();
  let isHomeCity = false;
  let unlockInfo = { unlocked: false, remaining: 10, percentage: 0 };

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_city_id, contribution_count")
      .eq("id", user.id)
      .single();

    if (profile) {
      isHomeCity = profile.home_city_id === city.id;
      unlockInfo = getUnlockProgress(profile.contribution_count || 0);
    }
  }

  const cityAccessible = isHomeCity || unlockInfo.unlocked;

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

      {/* Unlock progress for non-home cities */}
      {!isHomeCity && !unlockInfo.unlocked && (
        <div className="px-4 pb-6">
          <UnlockProgress
            remaining={unlockInfo.remaining}
            percentage={unlockInfo.percentage}
            unlocked={unlockInfo.unlocked}
          />
        </div>
      )}

      {/* Gated content */}
      {cityAccessible ? (
        <>
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
        </>
      ) : (
        /* Locked state — show preview */
        <div className="px-4 pb-24">
          <div className="relative">
            <div className="space-y-3 opacity-40 blur-[2px] pointer-events-none">
              {(places || []).slice(0, 3).map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl bg-white/90 px-6 py-4 text-center shadow-lg backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-8 w-8 text-ink-light">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <p className="mt-2 text-sm font-medium text-ink">City locked</p>
                <p className="mt-1 text-xs text-ink-light">
                  Log more places to unlock this city
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
