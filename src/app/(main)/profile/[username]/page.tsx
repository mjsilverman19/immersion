import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getTopVibeTags, cosineSimilarity } from "@/lib/taste-vector";
import OwnProfileClient from "./own-profile-client";
import VisitorProfileClient from "./visitor-profile-client";
import type { ProfileWithCity, LogWithPlace, ListWithItems } from "@/lib/types/queries";

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

  // ── Own profile ──
  if (isOwnProfile) {
    const { data: placeSaves } = await supabase
      .from("place_saves")
      .select(
        `
        user_id,
        place_id,
        source_user_id,
        created_at,
        place:places!place_saves_place_id_fkey(id, name, photo_urls, latitude, longitude, city_id, city:cities!places_city_id_fkey(id, name, slug))
      `
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    // Group place saves by city for city boards
    const cityBoardsMap = new Map<string, { cityName: string; photos: (string | null)[]; count: number }>();
    for (const save of (placeSaves || []) as unknown as Array<{ place: { photo_urls: string[] | null; city: { id: string; name: string } | null } | null }>) {
      const p = save.place;
      if (!p?.city) continue;
      const cityId = p.city.id;
      if (!cityBoardsMap.has(cityId)) {
        cityBoardsMap.set(cityId, { cityName: p.city.name, photos: [], count: 0 });
      }
      const board = cityBoardsMap.get(cityId)!;
      board.count++;
      if (board.photos.length < 4) {
        board.photos.push(p.photo_urls?.[0] ?? null);
      }
    }

    const cityBoards = [...cityBoardsMap.values()].map((b) => ({
      cityName: b.cityName,
      savedCount: b.count,
      photos: [...b.photos, null, null, null, null].slice(0, 4),
    }));

    // Build map pins
    const logPins = userLogs
      .filter((l) => l.place?.latitude && l.place?.longitude)
      .map((l) => ({
        lat: l.place!.latitude,
        lng: l.place!.longitude,
        type: "logged" as const,
      }));

    const savePins = ((placeSaves || []) as unknown as Array<{ place: { latitude: number; longitude: number } | null }>)
      .filter((s) => s.place?.latitude && s.place?.longitude)
      .map((s) => ({
        lat: s.place!.latitude,
        lng: s.place!.longitude,
        type: "saved" as const,
      }));

    const vibeTags = getTopVibeTags(userLogs.map((l) => ({ vibe_tags: l.vibe_tags })));

    const mapCenter: [number, number] | undefined = city
      ? [city.latitude, city.longitude]
      : undefined;

    return (
      <OwnProfileClient
        profile={{
          username: typedProfile.username,
          displayName: typedProfile.display_name,
          avatarUrl: typedProfile.avatar_url,
          bio: typedProfile.bio,
          cityName: city ? `${city.name}, ${city.country}` : null,
        }}
        stats={{
          places: userLogs.length,
          lists: userLists.length,
          followers: followerCount || 0,
          following: followingCount || 0,
        }}
        mapPins={[...logPins, ...savePins]}
        mapCenter={mapCenter}
        logCount={logPins.length}
        saveCount={savePins.length}
        cityName={city?.name || null}
        vibeTags={vibeTags}
        cityBoards={cityBoards}
        lists={userLists.map((list) => {
          const items = list.list_items || [];
          const coverPhoto = items.map((item) => item.place?.photo_urls?.[0]).filter(Boolean)[0] as string | undefined;
          return {
            id: list.id,
            title: list.title,
            placeCount: items.length,
            coverPhoto: coverPhoto || null,
          };
        })}
        recentLogs={userLogs.slice(0, 10).map((log) => ({
          id: log.id,
          placeId: log.place?.id || "",
          name: log.place?.name || "",
          neighborhood: log.place?.city?.name || "",
          rating: log.rating,
          photoUrl: log.place?.photo_urls?.[0] || null,
        }))}
      />
    );
  }

  // ── Visitor profile ──
  // Fetch viewer's data for alignment computation
  const [
    { data: viewerProfile },
    { data: viewerLogs },
    { data: viewerSaves },
    { data: followRow },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("taste_vector")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("logs")
      .select("place_id, vibe_tags")
      .eq("user_id", user!.id),
    supabase
      .from("place_saves")
      .select("place_id")
      .eq("user_id", user!.id),
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user!.id)
      .eq("following_id", profile.id)
      .maybeSingle(),
  ]);

  const isFollowing = !!followRow;

  // Compute alignment score
  let alignmentScore: number | null = null;
  if (
    userLogs.length >= 3 &&
    viewerProfile?.taste_vector &&
    (profile as Record<string, unknown>).taste_vector
  ) {
    const similarity = cosineSimilarity(
      viewerProfile.taste_vector as number[],
      (profile as Record<string, unknown>).taste_vector as number[]
    );
    alignmentScore = Math.round(Math.max(0, similarity) * 100);
  }

  // Compute shared vibe tags
  const viewerVibeSet = new Set<string>();
  for (const log of viewerLogs || []) {
    for (const tag of (log.vibe_tags as string[] | null) || []) {
      viewerVibeSet.add(tag);
    }
  }
  const localVibeSet = new Set<string>();
  for (const log of userLogs) {
    for (const tag of log.vibe_tags || []) {
      localVibeSet.add(tag);
    }
  }
  const sharedTags = [...viewerVibeSet].filter((tag) => localVibeSet.has(tag));

  // Compute alignment places (local's logs not in viewer's logs, sorted by rating)
  const viewerPlaceIds = new Set(
    (viewerLogs || []).map((l) => l.place_id)
  );
  const alignScore = alignmentScore ?? 50;
  const alignmentPlaces = userLogs
    .filter((log) => log.place && !viewerPlaceIds.has(log.place.id))
    .sort(
      (a, b) =>
        b.rating * alignScore - a.rating * alignScore
    )
    .slice(0, 5)
    .map((log) => ({
      placeId: log.place!.id,
      name: log.place!.name,
      neighborhood: log.place!.city?.name || null,
      category: log.place!.category || "experience",
      rating: log.rating,
      review: log.review,
    }));

  // Viewer's saved place IDs (for initial button states)
  const savedPlaceIds = (viewerSaves || []).map(
    (s) => s.place_id
  );

  // Map pins (heart only for visitor view)
  const visitorMapPins = userLogs
    .filter((l) => l.place?.latitude && l.place?.longitude)
    .map((l) => ({
      lat: l.place!.latitude,
      lng: l.place!.longitude,
      type: "logged" as const,
      placeId: l.place!.id,
      name: l.place!.name,
      rating: l.rating,
      vibeTag: (l.vibe_tags || [])[0] || undefined,
    }));

  const vibeTags = getTopVibeTags(
    userLogs.map((l) => ({ vibe_tags: l.vibe_tags }))
  );

  const firstName = (
    typedProfile.display_name || typedProfile.username
  ).split(" ")[0];

  return (
    <VisitorProfileClient
      profile={{
        id: typedProfile.id,
        username: typedProfile.username,
        displayName: typedProfile.display_name,
        avatarUrl: typedProfile.avatar_url,
        bio: typedProfile.bio,
        cityName: city ? `${city.name}, ${city.country}` : null,
        firstName,
      }}
      stats={{
        places: userLogs.length,
        lists: userLists.length,
        followers: followerCount || 0,
        following: followingCount || 0,
      }}
      mapPins={visitorMapPins}
      alignmentScore={alignmentScore}
      sharedTags={sharedTags}
      alignmentPlaces={alignmentPlaces}
      vibeTags={vibeTags}
      lists={userLists.map((list) => {
        const items = list.list_items || [];
        const coverPhoto = items
          .map((item) => item.place?.photo_urls?.[0])
          .filter(Boolean)[0] as string | undefined;
        return {
          id: list.id,
          title: list.title,
          placeCount: items.length,
          coverPhoto: coverPhoto || null,
        };
      })}
      recentLogs={userLogs.slice(0, 10).map((log) => ({
        id: log.id,
        placeId: log.place?.id || "",
        name: log.place?.name || "",
        neighborhood: log.place?.city?.name || "",
        rating: log.rating,
        photoUrl: log.place?.photo_urls?.[0] || null,
      }))}
      savedPlaceIds={savedPlaceIds}
      isFollowing={isFollowing}
    />
  );
}
