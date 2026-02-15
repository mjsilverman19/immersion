"use client";

import { FILTER_CATEGORIES } from "@/lib/discover/categories";

interface CategoryFilterProps {
  selected: string | null;
  onChange: (category: string | null) => void;
}

export default function CategoryFilter({
  selected,
  onChange,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {FILTER_CATEGORIES.map((cat) => {
        const isActive = selected === cat.value;
        return (
          <button
            key={cat.label}
            onClick={() => onChange(cat.value)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-ink text-cream"
                : "bg-cream-dark text-ink-light hover:bg-cream-dark/80"
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
