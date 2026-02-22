"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";

interface FollowButtonProps {
  userId: string;
  size?: "sm" | "md";
}

export default function FollowButton({ userId, size = "md" }: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkFollow = async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .maybeSingle();

      setIsFollowing(!!data);
      setLoading(false);
    };

    checkFollow();
  }, [user, userId, supabase]);

  if (!user || user.id === userId) return null;

  const handleToggle = async () => {
    const prev = isFollowing;
    setIsFollowing(!prev);

    const res = await fetch("/api/follows", {
      method: prev ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ following_id: userId }),
    });

    if (!res.ok) {
      setIsFollowing(prev);
    }
  };

  const sizeClasses = size === "sm"
    ? "px-3 py-1 text-xs"
    : "px-4 py-1.5 text-sm";

  if (loading) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border border-cream-dark ${sizeClasses} text-cream-dark`}>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors ${sizeClasses} ${
        isFollowing
          ? "bg-rust text-white"
          : "border border-rust text-rust hover:bg-rust/5"
      }`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
