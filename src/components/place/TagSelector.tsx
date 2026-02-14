"use client";

import { useState } from "react";
import type { PlaceCategory } from "@/lib/types/database";
import { CATEGORY_TAGS } from "@/constants/tags";

interface TagSelectorProps {
  category: PlaceCategory;
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagSelector({ category, selectedTags, onChange }: TagSelectorProps) {
  const [customTag, setCustomTag] = useState("");
  const predefinedTags = CATEGORY_TAGS[category] || [];

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
      <label className="mb-2 block text-sm font-medium">Tags</label>
      <div className="flex flex-wrap gap-2">
        {predefinedTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedTags.includes(tag)
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={addCustomTag}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}
