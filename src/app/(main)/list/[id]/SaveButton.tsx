"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

export default function SaveButton({ listId }: { listId: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const toggleSave = async () => {
    setLoading(true);

    if (saved) {
      const res = await fetch(`/api/saves?list_id=${listId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSaved(false);
        toast("List unsaved");
      }
    } else {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listId }),
      });

      if (res.ok) {
        setSaved(true);
        toast("List saved!");
      }
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggleSave}
      disabled={loading}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        saved
          ? "bg-ink text-cream"
          : "border border-cream-dark text-ink-light hover:bg-cream-dark"
      }`}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
