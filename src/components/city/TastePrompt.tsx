"use client";

import { useState } from "react";
import { VIBE_TAGS } from "@/constants/tags";

interface TastePromptProps {
  onSaved: () => void;
}

export default function TastePrompt({ onSaved }: TastePromptProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (selectedTags.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/taste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taste_preferences: selectedTags }),
      });
      if (res.ok) {
        onSaved();
      }
    } catch {
      // Silently fail
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="font-medium text-ink text-sm">
        What vibes do you love?
      </h3>
      <p className="mt-1 text-xs text-ink-light">
        Pick a few tags to get personalized recommendations
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {VIBE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedTags.includes(tag)
                ? "bg-ink text-cream"
                : "bg-cream-dark text-ink-light hover:bg-cream-dark/80"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {selectedTags.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-full bg-rust px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-rust/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save ${selectedTags.length} preferences`}
        </button>
      )}
    </div>
  );
}
