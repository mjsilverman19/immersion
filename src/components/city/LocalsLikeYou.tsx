"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import TasteMatchCard from "./TasteMatchCard";

interface LocalMatch {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  contribution_count: number;
  taste_match: number;
  taste_preferences: string[];
}

export default function LocalsLikeYou({ cityId }: { cityId: string }) {
  const [locals, setLocals] = useState<LocalMatch[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch taste matches
        const res = await fetch(`/api/discover/locals?city_id=${cityId}`);
        if (res.ok) {
          const data = await res.json();
          setLocals(
            (data.locals || [])
              .filter((l: LocalMatch) => l.taste_match > 0)
              .slice(0, 8)
          );
        }

        // Fetch current user's follows (reads are safe client-side)
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: follows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          if (follows) {
            setFollowingIds(new Set(follows.map((f) => f.following_id)));
          }
        }
      } catch {
        // Silently fail — section just won't show
      }
      setLoading(false);
    };
    fetchData();
  }, [cityId]);

  const handleFollow = useCallback(async (userId: string) => {
    const isCurrentlyFollowing = followingIds.has(userId);
    const method = isCurrentlyFollowing ? "DELETE" : "POST";

    // Optimistic update
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFollowing) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });

    try {
      const res = await fetch("/api/follows", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ following_id: userId }),
      });
      if (!res.ok) {
        // Revert on failure
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (isCurrentlyFollowing) {
            next.add(userId);
          } else {
            next.delete(userId);
          }
          return next;
        });
      }
    } catch {
      // Revert on error
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    }
  }, [followingIds]);

  if (loading || locals.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 px-4 text-xs font-medium uppercase tracking-widest text-ink-light">
        Your Top Taste Matches
      </h2>
      <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-2">
        {locals.map((local) => (
          <TasteMatchCard
            key={local.id}
            username={local.username}
            displayName={local.display_name}
            avatarUrl={local.avatar_url}
            tasteMatch={local.taste_match}
            tastePreferences={local.taste_preferences || []}
            isFollowing={followingIds.has(local.id)}
            onFollow={() => handleFollow(local.id)}
          />
        ))}
      </div>
    </div>
  );
}
