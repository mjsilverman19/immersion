"use client";

import { useState } from "react";

interface SavePlaceButtonProps {
  placeId: string;
  sourceUserId: string;
  initialSaved?: boolean;
}

export default function SavePlaceButton({
  placeId,
  sourceUserId,
  initialSaved = false,
}: SavePlaceButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (saved || loading) return;
    setSaved(true);
    setLoading(true);

    const res = await fetch("/api/place-saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId, source_user_id: sourceUserId }),
    });

    if (!res.ok) {
      setSaved(false);
    }
    setLoading(false);
  };

  if (saved) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-indigo text-white text-[13px] font-medium px-3.5 py-1.5 leading-none">
        Saved
      </span>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-full border border-indigo/30 text-indigo text-[13px] font-medium px-3.5 py-1.5 leading-none transition-colors hover:bg-indigo/5"
    >
      Save
    </button>
  );
}
