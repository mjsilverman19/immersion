"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import { ToastProvider } from "@/components/ui/Toast";
import LogForm from "@/components/place/LogForm";
import type { Place } from "@/lib/types/database";

export default function LogFormWrapper({ place }: { place: Place }) {
  const { user } = useAuth();
  const [existingLog, setExistingLog] = useState<{
    id: string;
    rating: number;
    tags: string[];
    vibe_tags?: string[];
    review: string | null;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    const fetchLog = async () => {
      const { data } = await supabase
        .from("logs")
        .select("id, rating, tags, vibe_tags, review")
        .eq("user_id", user.id)
        .eq("place_id", place.id)
        .maybeSingle();
      setExistingLog(data);
      setLoaded(true);
    };
    fetchLog();
  }, [user, place.id, supabase]);

  if (!loaded) return <div className="py-8 text-center text-sm text-ink-light">Loading...</div>;

  return (
    <ToastProvider>
      <LogForm place={place} existingLog={existingLog} />
    </ToastProvider>
  );
}
