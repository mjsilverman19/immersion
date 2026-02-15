import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PlaceCard from "@/components/place/PlaceCard";
import ListCard from "@/components/list/ListCard";
import Avatar from "@/components/ui/Avatar";
import CityMap from "@/components/map/CityMap";
import RecommendedForYou from "@/components/city/RecommendedForYou";
import LocalsLikeYou from "@/components/city/LocalsLikeYou";
import Link from "next/link";
import type { ListWithAuthor } from "@/lib/types/queries";

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

  // Parallelize independent queries after city fetch
  const [
    { data: { user } },
    { data: places },
    { data: lists },
    { data: locals },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("places")
      .select("*")
      .eq("city_id", city.id)
      .limit(20),
    supabase
      .from("lists")
      .select("*, profiles!lists_user_id_fkey(username, display_name, avatar_url)")
      .eq("city_id", city.id)
      .eq("is_public", true)
      .order("save_count", { ascending: false })
      .limit(10),
    supabase
      .from("profiles")
      .select("*")
      .eq("home_city_id", city.id)
      .order("contribution_count", { ascending: false })
      .limit(10),
  ]);

  let hasTastePreferences = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("taste_preferences")
      .eq("id", user.id)
      .single();
    hasTastePreferences =
      (profile?.taste_preferences?.length ?? 0) > 0;
  }

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

      {/* Recommended for You (auth-gated client component) */}
      {user && (
        <RecommendedForYou
          cityId={city.id}
          hasTastePreferences={hasTastePreferences}
        />
      )}

      {/* Locals Like You — taste matching */}
      <LocalsLikeYou cityId={city.id} />

      {/* All Places */}
      <div className="px-4 pb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
          All Places
        </h2>
        <div className="space-y-3">
          {(places || []).map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
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
            {(lists as unknown as ListWithAuthor[]).map((list) => (
                <ListCard
                  key={list.id}
                  list={{
                    ...list,
                    user: list.profiles ? {
                      username: list.profiles.username,
                      avatar_url: list.profiles.avatar_url,
                      display_name: list.profiles.display_name,
                    } : null,
                    city: { name: city.name },
                  }}
                />
            ))}
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
