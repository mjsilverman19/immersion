"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import { useToast } from "@/components/ui/Toast";

export default function SaveButton({ listId }: { listId: string }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  const toggleSave = async () => {
    if (!user) return;
    setLoading(true);

    if (saved) {
      await supabase.from("saves").delete().eq("user_id", user.id).eq("list_id", listId);
      setSaved(false);
      toast("List unsaved");
    } else {
      await supabase.from("saves").insert({ user_id: user.id, list_id: listId });
      setSaved(true);
      toast("List saved!");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggleSave}
      disabled={loading || !user}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        saved
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      }`}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
