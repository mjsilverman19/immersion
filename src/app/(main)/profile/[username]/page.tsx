import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import RatingStars from "@/components/place/RatingStars";
import ListCard from "@/components/list/ListCard";
import Link from "next/link";

interface Props {
  params: { username: string };
}

export default async function ProfilePage({ params }: Props) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, city:cities!profiles_home_city_id_fkey(*)")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  const { data: logs } = await supabase
    .from("logs")
    .select("*, place:places!logs_place_id_fkey(*, city:cities!places_city_id_fkey(name))")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const { data: lists } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", profile.id);

  const city = profile.city as { name: string; country: string } | null;

  // Calculate taste profile
  const userLogs = logs || [];
  const tagCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let totalRating = 0;

  userLogs.forEach((log: Record<string, unknown>) => {
    totalRating += log.rating as number;
    const tags = log.tags as string[];
    tags?.forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const place = log.place as Record<string, unknown> | null;
    if (place) {
      const cat = place.category as string;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalLogs = userLogs.length;
  const avgRating = totalLogs > 0 ? totalRating / totalLogs : 0;

  return (
    <div>
      <div className="border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            size="xl"
          />
          <div>
            <h1 className="text-xl font-bold">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-gray-500">@{profile.username}</p>
            {city && (
              <p className="mt-1 text-sm text-gray-500">
                {city.name}, {city.country}
                {profile.is_local_verified && " (verified local)"}
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm">{profile.bio}</p>
        )}

        <div className="mt-4 flex gap-6 text-sm">
          <span><strong>{totalLogs}</strong> logs</span>
          <span><strong>{lists?.length || 0}</strong> lists</span>
          <span><strong>{followerCount || 0}</strong> followers</span>
          <span><strong>{followingCount || 0}</strong> following</span>
        </div>

        {topTags.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Top Tags</p>
            <div className="flex flex-wrap gap-1">
              {topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  {tag} ({count})
                </span>
              ))}
            </div>
          </div>
        )}

        {totalLogs > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            Average rating: {avgRating.toFixed(1)} / 5
          </div>
        )}
      </div>

      {/* Logs section */}
      <div className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Recent Logs</h2>
        {userLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No logs yet</p>
        ) : (
          <div className="space-y-3">
            {userLogs.map((log: Record<string, unknown>) => {
              const place = log.place as Record<string, unknown> | null;
              return (
                <Link key={log.id as string} href={`/place/${place?.id}`} className="block">
                  <div className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{place?.name as string}</p>
                        <span className="text-xs text-gray-500">{place?.category as string}</span>
                      </div>
                      <RatingStars rating={log.rating as number} size="sm" />
                    </div>
                    {(log.tags as string[])?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(log.tags as string[]).map((tag: string) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Lists section */}
      {lists && lists.length > 0 && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <h2 className="mb-4 text-lg font-semibold">Lists</h2>
          <div className="space-y-3">
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
