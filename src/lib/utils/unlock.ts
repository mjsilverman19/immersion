import { createClient } from "@/lib/supabase/server";
import { UNLOCK_THRESHOLD } from "@/constants/unlock";

export async function canAccessCity(
  userId: string,
  cityId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city_id, contribution_count")
    .eq("id", userId)
    .single();

  if (!profile) return false;
  if (profile.home_city_id === cityId) return true;
  return profile.contribution_count >= UNLOCK_THRESHOLD;
}

export function getUnlockProgress(contributionCount: number): {
  unlocked: boolean;
  remaining: number;
  percentage: number;
} {
  const remaining = Math.max(0, UNLOCK_THRESHOLD - contributionCount);
  return {
    unlocked: contributionCount >= UNLOCK_THRESHOLD,
    remaining,
    percentage: Math.min(100, Math.round((contributionCount / UNLOCK_THRESHOLD) * 100)),
  };
}
