"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import FeedItem from "@/components/feed/FeedItem";
import { FeedSkeleton } from "@/components/ui/LoadingSkeleton";

type FeedMode = "following" | "discover";

interface FeedEntry {
  type: "log" | "list";
  id: string;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
  rating?: number;
  tags?: string[];
  review?: string | null;
  place?: {
    id: string;
    name: string;
    category: string;
    city?: { name: string } | null;
  } | null;
  listTitle?: string;
  listId?: string;
  itemCount?: number;
}

export default function FeedPage() {
  const [mode, setMode] = useState<FeedMode>("discover");
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchFeed = useCallback(async (cursor?: string | null) => {
    if (!user) return;
    setLoading(true);

    const pageSize = 20;
    let logQuery = supabase
      .from("logs")
      .select("*, profiles!logs_user_id_fkey(username, display_name, avatar_url), places!logs_place_id_fkey(id, name, category, city:cities!places_city_id_fkey(name))")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (mode === "following") {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = following?.map((f) => f.following_id) || [];
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      logQuery = logQuery.in("user_id", ids);
    }

    if (cursor) {
      logQuery = logQuery.lt("created_at", cursor);
    }

    const { data: logs } = await logQuery;

    const entries: FeedEntry[] = (logs || []).map((log: Record<string, unknown>) => {
      const profiles = log.profiles as Record<string, unknown> | null;
      const places = log.places as Record<string, unknown> | null;
      return {
        type: "log" as const,
        id: log.id as string,
        user: {
          username: (profiles?.username as string) || "",
          display_name: (profiles?.display_name as string) || null,
          avatar_url: (profiles?.avatar_url as string) || null,
        },
        created_at: log.created_at as string,
        rating: log.rating as number,
        tags: log.tags as string[],
        review: log.review as string | null,
        place: places ? {
          id: places.id as string,
          name: places.name as string,
          category: places.category as string,
          city: places.city as { name: string } | null,
        } : null,
      };
    });

    if (entries.length < pageSize) {
      setHasMore(false);
    }

    if (cursor) {
      setItems((prev) => [...prev, ...entries]);
    } else {
      setItems(entries);
    }

    if (entries.length > 0) {
      cursorRef.current = entries[entries.length - 1].created_at;
    }
    setLoading(false);
  }, [user, mode, supabase]);

  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchFeed();
  }, [fetchFeed]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchFeed(cursorRef.current);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div>
        <div className="sticky top-0 z-10 flex gap-2 border-b border-gray-200 bg-white p-4">
          <button className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white">
            {mode === "following" ? "Following" : "Discover"}
          </button>
        </div>
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-2 border-b border-gray-200 bg-white p-4">
        <button
          onClick={() => setMode("following")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "following"
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          Following
        </button>
        <button
          onClick={() => setMode("discover")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "discover"
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          Discover
        </button>
      </div>

      <div className="space-y-4 p-4">
        {items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500">
              {mode === "following"
                ? "Follow some locals to see their activity here."
                : "No activity yet. Be the first to log a place!"}
            </p>
          </div>
        )}

        {items.map((item) => (
          <FeedItem key={item.id} item={item} />
        ))}

        {hasMore && items.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full rounded-lg bg-gray-100 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
