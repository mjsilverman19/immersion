"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/ui/FollowButton";

interface LocalMatch {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  contribution_count: number;
  taste_match: number;
  confidence?: "high" | "medium" | "low" | "new";
  top_vibe_tags?: string[];
  is_new?: boolean;
}

export default function LocalsLikeYou({ cityId }: { cityId: string }) {
  const [locals, setLocals] = useState<LocalMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocals = async () => {
      try {
        const res = await fetch(`/api/discover/locals?city_id=${cityId}`);
        if (res.ok) {
          const data = await res.json();
          setLocals(
            (data.locals || [])
              .filter((l: LocalMatch) => l.taste_match > 0 || l.is_new)
              .slice(0, 6)
          );
        }
      } catch {
        // Silently fail — section just won't show
      }
      setLoading(false);
    };
    fetchLocals();
  }, [cityId]);

  if (loading || locals.length === 0) return null;

  return (
    <div className="px-4 pb-6">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-light">
        Locals Like You
      </h2>
      <div className="space-y-2">
        {locals.map((local) => (
          <div
            key={local.id}
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
          >
            <Link href={`/profile/${local.username}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar
                src={local.avatar_url}
                alt={local.display_name || local.username}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink truncate">
                  {local.display_name || local.username}
                </p>
                <p className="text-xs text-ink-light">
                  {local.contribution_count} places logged
                </p>
              </div>
              <div className="flex-shrink-0 rounded-full bg-rust-light/30 px-2.5 py-1">
                <span className="text-xs font-medium text-rust">
                  {local.is_new ? "New local" : `${local.taste_match}% match`}
                </span>
              </div>
            </Link>
            <FollowButton userId={local.id} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
