"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";

interface FollowButtonProps {
  userId: string;
  size?: "sm" | "md";
  variant?: "rust" | "indigo";
  className?: string;
  /** When provided, skips the client-side auth check and uses this value */
  initialFollowing?: boolean;
}

export default function FollowButton({ userId, size = "md", variant = "rust", className = "", initialFollowing }: FollowButtonProps) {
  const { user } = useAuth();
  const serverProvided = initialFollowing !== undefined;
  const [isFollowing, setIsFollowing] = useState(initialFollowing ?? false);
  const [loading, setLoading] = useState(!serverProvided);
  const supabase = createClient();

  useEffect(() => {
    // Skip client-side check if server already provided the state
    if (serverProvided) return;

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
  }, [user, userId, supabase, serverProvided]);

  // Only hide when not server-provided and auth isn't available
  if (!serverProvided && (!user || user.id === userId)) return null;

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

  const colorClasses = variant === "indigo"
    ? isFollowing
      ? "bg-indigo text-white"
      : "border border-indigo/30 text-indigo hover:bg-indigo/5"
    : isFollowing
      ? "bg-rust text-white"
      : "border border-rust text-rust hover:bg-rust/5";

  if (loading) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border border-cream-dark ${sizeClasses} text-cream-dark ${className}`}>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors ${sizeClasses} ${colorClasses} ${className}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
