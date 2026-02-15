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
  const photos = (place.photo_urls as string[] | null) || [];

  return (
    <div className="bg-cream min-h-screen">
      {/* Photo hero */}
      {photos.length > 0 ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-cream-dark">
          <img src={photos[0]} alt={place.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-cream-dark">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-12 w-12 text-ink-light/30">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
      )}

      {/* Place info */}
      <div className="px-4 pt-5 pb-4">
        <h1 className="font-serif text-2xl text-ink">{place.name}</h1>
        {place.address && (
          <p className="mt-1 text-sm text-ink-light">{place.address}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-ink-light capitalize">
            {place.category?.replace("_", " ")}
          </span>
          {city && (
            <span className="text-xs text-ink-light">
              {city.name as string}, {city.country as string}
            </span>
          )}
        </div>

        {totalLogs > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div>
              <RatingStars rating={Math.round(avgRating)} size="md" />
              <p className="mt-0.5 text-xs text-ink-light">
                {avgRating.toFixed(1)} avg ({totalLogs} logs)
              </p>
            </div>
            {localLogs > 0 && (
              <span className="rounded-full bg-cream-dark px-2 py-0.5 text-xs text-ink-light">
                {localPct}% local
              </span>
            )}
          </div>
        )}

        <Link
          href={`/place/${params.id}/log`}
          className="mt-5 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          Log this place
        </Link>
      </div>

      {/* Logs section */}
      <div className="px-4 pb-24">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
          Logs
        </h2>
        {allLogs.length === 0 ? (
          <p className="text-sm text-ink-light">No logs yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {allLogs.map((log) => {
              const user = log.profiles as Record<string, unknown> | null;
              return (
                <div key={log.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user?.avatar_url as string | null}
                      alt={(user?.display_name || user?.username) as string}
                      size="sm"
                    />
                    <div className="flex-1">
                      <Link href={`/profile/${user?.username}`} className="text-sm font-medium text-ink hover:underline">
                        {(user?.display_name || user?.username) as string}
                      </Link>
                      {log.is_local_log && (
                        <span className="ml-2 rounded-full bg-rust-light/30 px-1.5 py-0.5 text-[10px] font-medium text-rust">
                          local
                        </span>
                      )}
                    </div>
                    <RatingStars rating={log.rating} size="sm" />
                  </div>
                  {log.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {log.tags.map((tag: string) => (
                        <span key={tag} className="rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.review && (
                    <p className="mt-2 text-sm text-ink-light">
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
