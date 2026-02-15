"use client";

import { useState } from "react";
import { VIBE_TAGS } from "@/constants/tags";

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const [customTag, setCustomTag] = useState("");

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const tag = customTag.trim().toLowerCase();
    if (tag && !selectedTags.includes(tag)) {
      onChange([...selectedTags, tag]);
      setCustomTag("");
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">Tags</label>
      <div className="flex flex-wrap gap-2">
        {VIBE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedTags.includes(tag)
                ? "bg-ink text-cream"
                : "bg-cream-dark text-ink-light hover:bg-cream-dark/80"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
          placeholder="Add custom tag"
          className="flex-1 rounded-full border border-cream-dark bg-white px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustomTag}
          className="rounded-full bg-cream-dark px-4 py-1.5 text-sm font-medium text-ink hover:bg-cream-dark/80"
        >
          Add
        </button>
      </div>
    </div>
  );
}
