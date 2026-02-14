"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-provider";

export default function ProfileRedirect() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (profile?.username) {
      router.replace(`/profile/${profile.username}`);
    }
  }, [profile, isLoading, router]);

  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
      <p className="text-sm text-gray-400">Loading profile...</p>
    </div>
  );
}
