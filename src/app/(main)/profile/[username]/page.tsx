import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import PlaceCardCompact from "@/components/place/PlaceCardCompact";
import FollowButton from "@/components/ui/FollowButton";
import Link from "next/link";
import type { ProfileWithCity, LogWithPlace, ListWithItems } from "@/lib/types/queries";

interface Props {
  params: { username: string };
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default async function ProfilePage({ params }: Props) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, city:cities!profiles_home_city_id_fkey(*)")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  const [
    { data: logs },
    { data: lists },
    { count: followerCount },
    { count: followingCount },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from("logs")
      .select("*, place:places!logs_place_id_fkey(*, city:cities!places_city_id_fkey(name))")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lists")
      .select("*, list_items(id, place:places!list_items_place_id_fkey(photo_urls))")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase.auth.getUser(),
  ]);

  const typedProfile = profile as unknown as ProfileWithCity;
  const city = typedProfile.city;
  const userLogs = (logs || []) as unknown as LogWithPlace[];
  const userLists = (lists || []) as unknown as ListWithItems[];
  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="bg-cream min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-serif text-xl text-ink">immersion</h2>
        <div className="flex items-center gap-3">
          {isOwnProfile && (
            <Link href={`/profile/${profile.username}/edit`} className="text-ink-light">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* User info block */}
      <div className="px-4 pb-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            size="xl"
          />
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="font-serif text-2xl text-ink truncate">
              {profile.display_name || profile.username}
            </h1>
            {city && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-light">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {city.name}, {city.country}
              </p>
            )}
            {!isOwnProfile && (
              <div className="mt-2">
                <FollowButton userId={profile.id} />
              </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="mt-3 text-sm text-ink-light">{profile.bio}</p>
        )}

        <div className="mt-3 flex gap-4 text-sm text-ink-light">
          <span><strong className="text-ink">{formatCount(userLogs.length)}</strong> places</span>
          <span><strong className="text-ink">{formatCount(userLists.length)}</strong> lists</span>
          <span><strong className="text-ink">{formatCount(followerCount || 0)}</strong> followers</span>
          <span><strong className="text-ink">{formatCount(followingCount || 0)}</strong> following</span>
        </div>
      </div>

      {/* LISTS section */}
      {userLists.length > 0 && (
        <div className="pb-6">
          <h3 className="mb-3 px-4 text-xs font-medium uppercase tracking-widest text-ink-light">
            Lists
          </h3>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
            {userLists.map((list) => {
              const items = list.list_items || [];
              const photos = items
                .map((item) => item.place?.photo_urls?.[0])
                .filter(Boolean) as string[];

              return (
                <Link
                  key={list.id}
                  href={`/list/${list.id}`}
                  className="flex-shrink-0 snap-start"
                  style={{ width: "160px" }}
                >
                  <div className="h-24 w-full overflow-hidden rounded-lg bg-cream-dark">
                    {photos.length >= 4 ? (
                      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                        {photos.slice(0, 4).map((url, i) => (
                          <img key={i} src={url} alt="" className="h-full w-full object-cover" />
                        ))}
                      </div>
                    ) : photos.length > 0 ? (
                      <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-ink-light/30">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-ink truncate">
                    {list.title}
                  </p>
                  <p className="text-xs text-ink-light">
                    {items.length} places
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* RECENT section */}
      <div className="px-4 pb-24">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
          Recent
        </h3>
        {userLogs.length === 0 ? (
          <p className="text-sm text-ink-light">No logs yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {userLogs.map((log) => (
              <PlaceCardCompact
                key={log.id}
                placeId={log.place?.id || ""}
                name={log.place?.name || ""}
                cityName={log.place?.city?.name}
                category={log.place?.category || "experience"}
                rating={log.rating}
                review={log.review}
                photoUrl={log.place?.photo_urls?.[0]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
