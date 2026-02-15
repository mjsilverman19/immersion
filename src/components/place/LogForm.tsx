"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-provider";
import { useToast } from "@/components/ui/Toast";
import RatingStars from "./RatingStars";
import TagSelector from "./TagSelector";
import type { Place, PlaceCategory } from "@/lib/types/database";

interface LogFormProps {
  place: Place;
  existingLog?: {
    id: string;
    rating: number;
    tags: string[];
    review: string | null;
  } | null;
}

export default function LogForm({ place, existingLog }: LogFormProps) {
  const [rating, setRating] = useState(existingLog?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(existingLog?.tags ?? []);
  const [review, setReview] = useState(existingLog?.review ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setLoading(true);

    const isLocalLog = profile?.home_city_id === place.city_id;

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: place.id,
          rating,
          tags,
          review: review || null,
          is_local_log: isLocalLog,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to save log");
        setLoading(false);
        return;
      }

      const data = await res.json();
      toast(data.updated ? "Log updated" : "Place logged!");
      router.push(`/place/${place.id}`);
      router.refresh();
    } catch (err) {
      console.error("Error saving log:", err);
      toast("Failed to save log");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-ink">{place.name}</h2>
        <p className="text-sm text-ink-light">{place.address}</p>
        <span className="mt-1 inline-block rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light capitalize">
          {place.category?.replace("_", " ")}
        </span>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">Rating</label>
        <RatingStars rating={rating} onChange={setRating} size="lg" interactive />
      </div>

      <TagSelector
        category={place.category as PlaceCategory}
        selectedTags={tags}
        onChange={setTags}
      />

      <div>
        <label htmlFor="review" className="mb-1 block text-sm font-medium text-ink">
          Review <span className="text-ink-light">(optional)</span>
        </label>
        <textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-ink focus:outline-none"
          placeholder="What made this place special?"
        />
        <p className="mt-1 text-right text-xs text-ink-light">
          {review.length}/2000
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full rounded-full bg-ink py-3 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
      >
        {loading ? "Saving..." : existingLog ? "Update log" : "Log it"}
      </button>
    </form>
  );
}
