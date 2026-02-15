"use client";

import Link from "next/link";
import RatingHearts from "./RatingHearts";

interface RecommendedPlaceCardProps {
  place: {
    id: string;
    name: string;
    address: string | null;
    category: string;
    photo_urls: string[] | null;
    score: number;
    match_level: "strong" | "good" | "moderate" | null;
    top_vibe_tags: string[];
    attribution: string | null;
    log_count: number;
    avg_rating: number;
  };
}

const matchBadge: Record<string, { label: string; className: string }> = {
  strong: {
    label: "Strong match",
    className: "bg-rust-light/30 text-rust",
  },
  good: {
    label: "Good match",
    className: "bg-rust-light/20 text-rust/80",
  },
  moderate: {
    label: "Moderate",
    className: "bg-cream-dark text-ink-light",
  },
};

export default function RecommendedPlaceCard({
  place,
}: RecommendedPlaceCardProps) {
  const photo = place.photo_urls?.[0];
  const badge = place.match_level ? matchBadge[place.match_level] : null;

  return (
    <Link href={`/place/${place.id}`} className="block flex-shrink-0 w-56">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Photo */}
        <div className="h-32 w-full bg-cream-dark">
          {photo ? (
            <img
              src={photo}
              alt={place.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-light/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-ink text-sm truncate flex-1">
              {place.name}
            </h3>
            {badge && (
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>

          {/* Vibe tags */}
          {place.top_vibe_tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {place.top_vibe_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Rating + logs */}
          <div className="mt-2 flex items-center gap-2">
            {place.avg_rating > 0 && (
              <RatingHearts rating={Math.round(place.avg_rating)} size="sm" />
            )}
            <span className="text-xs text-ink-light">
              {place.log_count} {place.log_count === 1 ? "log" : "logs"}
            </span>
          </div>

          {/* Attribution */}
          {place.attribution && (
            <p className="mt-1.5 text-[10px] text-ink-light italic">
              {place.attribution}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
