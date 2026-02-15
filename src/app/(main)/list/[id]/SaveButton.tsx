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
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        saved
          ? "bg-black text-white"
          : "border border-gray-300 hover:bg-gray-50"
      }`}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
