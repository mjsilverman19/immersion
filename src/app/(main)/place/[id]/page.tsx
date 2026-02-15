import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import RatingStars from "@/components/place/RatingStars";

interface Props {
  params: { id: string };
}

export default async function PlacePage({ params }: Props) {
  const supabase = createClient();

  const { data: place } = await supabase
    .from("places")
    .select("*, city:cities!places_city_id_fkey(*)")
    .eq("id", params.id)
    .single();

  if (!place) notFound();

  const { data: logs } = await supabase
    .from("logs")
    .select("*, profiles!logs_user_id_fkey(username, display_name, avatar_url)")
    .eq("place_id", params.id)
    .order("created_at", { ascending: false });

  const allLogs = logs || [];
  const totalLogs = allLogs.length;
  const avgRating = totalLogs > 0
    ? allLogs.reduce((sum, l) => sum + (l.rating as number), 0) / totalLogs
    : 0;
  const localLogs = allLogs.filter((l) => l.is_local_log).length;
  const localPct = totalLogs > 0 ? Math.round((localLogs / totalLogs) * 100) : 0;

  const city = place.city as Record<string, unknown> | null;

  return (
    <div>
      <div className="border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold">{place.name}</h1>
        {place.address && (
          <p className="mt-1 text-sm text-gray-500">{place.address}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {place.category}
          </span>
          {city && (
            <span className="text-xs text-gray-500">
              {city.name as string}, {city.country as string}
            </span>
          )}
        </div>

        {totalLogs > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div>
              <RatingStars rating={Math.round(avgRating)} size="md" />
              <p className="mt-0.5 text-xs text-gray-500">
                {avgRating.toFixed(1)} avg ({totalLogs} logs)
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {localPct}% local logs
            </div>
          </div>
        )}

        <Link
          href={`/place/${params.id}/log`}
          className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Log this place
        </Link>
      </div>

      <div className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Logs</h2>
        {allLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No logs yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {allLogs.map((log) => {
              const user = log.profiles as Record<string, unknown> | null;
              return (
                <div key={log.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user?.avatar_url as string | null}
                      alt={(user?.display_name || user?.username) as string}
                      size="sm"
                    />
                    <div className="flex-1">
                      <Link href={`/profile/${user?.username}`} className="text-sm font-medium hover:underline">
                        {(user?.display_name || user?.username) as string}
                      </Link>
                      {log.is_local_log && (
                        <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                          local
                        </span>
                      )}
                    </div>
                    <RatingStars rating={log.rating} size="sm" />
                  </div>
                  {log.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {log.tags.map((tag: string) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.review && (
                    <p className="mt-2 text-sm text-gray-600">
                      {log.review}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
