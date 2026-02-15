"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import FeedItem from "@/components/feed/FeedItem";
import { FeedSkeleton } from "@/components/ui/LoadingSkeleton";
import type { FeedLogRow } from "@/lib/types/queries";

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
  vibe_tags?: string[];
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

    const entries: FeedEntry[] = ((logs || []) as unknown as FeedLogRow[]).map((log) => ({
      type: "log" as const,
      id: log.id,
      user: {
        username: log.profiles?.username || "",
        display_name: log.profiles?.display_name || null,
        avatar_url: log.profiles?.avatar_url || null,
      },
      created_at: log.created_at,
      rating: log.rating,
      tags: log.tags,
      vibe_tags: log.vibe_tags || [],
      review: log.review,
      place: log.places ? {
        id: log.places.id,
        name: log.places.name,
        category: log.places.category,
        city: log.places.city,
      } : null,
    }));

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
      <div className="bg-cream min-h-screen">
        <div className="sticky top-0 z-10 flex gap-2 border-b border-cream-dark bg-cream/80 backdrop-blur-sm p-4">
          <button className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">
            {mode === "following" ? "Following" : "Discover"}
          </button>
        </div>
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen">
      <div className="sticky top-0 z-10 flex gap-2 border-b border-cream-dark bg-cream/80 backdrop-blur-sm p-4">
        <button
          onClick={() => setMode("following")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "following"
              ? "bg-ink text-cream"
              : "bg-cream-dark text-ink-light"
          }`}
        >
          Following
        </button>
        <button
          onClick={() => setMode("discover")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "discover"
              ? "bg-ink text-cream"
              : "bg-cream-dark text-ink-light"
          }`}
        >
          Discover
        </button>
      </div>

      <div className="space-y-3 p-4 pb-24">
        {items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-ink-light">
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
            className="w-full rounded-full bg-cream-dark py-3 text-sm font-medium text-ink-light hover:bg-cream-dark/80 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
