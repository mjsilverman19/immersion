import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/ui/FollowButton";

interface Props {
  params: { username: string };
}

export default async function FollowersPage({ params }: Props) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  const { data: follows } = await supabase
    .from("follows")
    .select(
      "follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, home_city_id, city:cities!profiles_home_city_id_fkey(name))"
    )
    .eq("following_id", profile.id)
    .order("created_at", { ascending: false });

  const followers = (follows || [])
    .map((f) => f.follower as unknown as {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      city: { name: string } | null;
    })
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark px-4 pt-[env(safe-area-inset-top)] pb-3 flex items-center gap-3">
        <Link href={`/profile/${params.username}`} className="w-10 h-10 flex items-center justify-center -ml-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-serif text-lg text-ink leading-tight">
          {profile.display_name || profile.username}&apos;s Followers
        </h1>
      </div>

      {/* List */}
      <div className="px-4 py-2">
        {followers.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-light">No followers yet</p>
        ) : (
          <div className="divide-y divide-cream-dark">
            {followers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 py-3">
                <Link href={`/profile/${user.username}`}>
                  <Avatar
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
                    size="md"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${user.username}`}>
                    <p className="text-sm font-medium text-ink truncate">
                      {user.display_name || user.username}
                    </p>
                  </Link>
                  {user.city && (
                    <p className="text-sm text-ink-light truncate">{user.city.name}</p>
                  )}
                </div>
                <FollowButton userId={user.id} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
